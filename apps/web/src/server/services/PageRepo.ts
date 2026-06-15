import { and, asc, desc, eq, notInArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Data, Effect } from "effect";
import { Database, DatabaseLive } from "@/db/layer";
import { DEFAULT_LAYOUT_NAME, layouts } from "@/db/schema/layouts";
import { type LayoutZoneOptions, layoutZones } from "@/db/schema/layoutZones";
import { DEFAULT_LOCALE, type Locale, pages } from "@/db/schema/pages";
import { users } from "@/db/schema/users";
import { widgets } from "@/db/schema/widgets";
import { type ZoneName, zones } from "@/db/schema/zones";
import { Policy } from "./Policy";
import type {
  PageLayout,
  WidgetConfig,
  WidgetKind,
  ZoneConfig,
  ZoneSize,
} from "@/routes/_authed/style-guide/types";

// A page is identified by a slug + locale. Routes pass these in; the repo bootstraps
// the page (linked to the default layout) on first access for any slug.
export interface PageRef {
  slug: string;
  locale?: Locale;
  // Title used only when the page is first created; defaults to a titleized slug.
  title?: string;
}

// Derives a human title from a slug when none is supplied (e.g. "about" -> "About").
const titleFromSlug = (slug: string) =>
  slug
    .split(/[-_/]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || slug;

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly cause: unknown;
}> {}

export class PageRepo extends Effect.Service<PageRepo>()("app/PageRepo", {
  effect: Effect.gen(function* () {
    const db = yield* Database;

    // The default layout id every new page is linked to. Resolved once and cached.
    let defaultLayoutId: string | undefined;
    const resolveDefaultLayoutId = async () => {
      if (defaultLayoutId) return defaultLayoutId;
      const layout = await db.query.layouts.findFirst({
        where: eq(layouts.name, DEFAULT_LAYOUT_NAME),
      });
      if (!layout) throw new Error(`default layout "${DEFAULT_LAYOUT_NAME}" is missing`);
      defaultLayoutId = layout.id;
      return defaultLayoutId;
    };

    // Upserts the page row for a ref, linking new pages to the default layout, and
    // returns it. Page-level arrangement comes from the layout, so nothing else is seeded.
    const ensurePage = async ({ slug, locale = DEFAULT_LOCALE, title }: PageRef) => {
      const layoutId = await resolveDefaultLayoutId();
      const inserted = await db
        .insert(pages)
        .values({ slug, locale, title: title ?? titleFromSlug(slug), layoutId })
        .onConflictDoNothing({ target: [pages.slug, pages.locale] })
        .returning();

      const page =
        inserted[0] ??
        (await db.query.pages.findFirst({
          where: and(eq(pages.slug, slug), eq(pages.locale, locale)),
        }));
      if (!page) throw new Error(`page "${slug}" (${locale}) could not be created`);
      return page;
    };

    // Loads a page's layout by (slug, locale): the zone arrangement comes from the
    // page's layout (layoutZone ⋈ zone), the widget content from the page itself.
    const getPageLayout = (ref: PageRef) =>
      Effect.tryPromise({
        try: async (): Promise<PageLayout & { layoutId: string }> => {
          const page = await ensurePage(ref);

          // Zone arrangement for this page's layout, ordered by the stored order.
          const zoneRows = await db
            .select({ zoneId: zones.id, name: zones.name, options: layoutZones.options })
            .from(layoutZones)
            .innerJoin(zones, eq(zones.id, layoutZones.zoneId))
            .where(eq(layoutZones.layoutId, page.layoutId))
            .orderBy(sql`(${layoutZones.options} ->> 'order')::int`);

          // This page's widget content, grouped into its zones below.
          const widgetRows = await db.query.widgets.findMany({
            where: eq(widgets.pageId, page.id),
            orderBy: asc(widgets.order),
          });

          return {
            layoutId: page.layoutId,
            zones: zoneRows.map((zr): ZoneConfig => {
              const opt = (zr.options ?? {}) as LayoutZoneOptions;
              return {
                id: zr.zoneId,
                name: zr.name as ZoneName,
                title: opt.title,
                size: opt.size as ZoneSize,
                order: opt.order,
                defaultOpen: opt.defaultOpen,
                widgets: widgetRows
                  .filter((w) => w.zoneId === zr.zoneId)
                  .map(
                    (w): WidgetConfig => ({
                      id: w.id,
                      kind: w.kind as WidgetKind,
                      size: (w.size ?? undefined) as ZoneSize | undefined,
                      options: (w.options ?? {}) as WidgetConfig["options"],
                    }),
                  ),
              };
            }),
          };
        },
        catch: (cause) => new DatabaseError({ cause }),
      });

    // Persists a page's widget content only. Zone arrangement is owned by the layout
    // and never written here. Widgets are reconciled scoped to the page; the parent
    // zone id (a catalog zone) and array index are the source of truth for placement.
    const savePageLayout = (ref: PageRef, layout: PageLayout) =>
      Effect.tryPromise({
        try: () =>
          db.transaction(async (tx) => {
            const page = await ensurePage(ref);
            const presentWidgetIds = layout.zones.flatMap((z) => z.widgets.map((w) => w.id));

            // Reconcile deletions: drop any of this page's widgets no longer present.
            await tx
              .delete(widgets)
              .where(
                presentWidgetIds.length > 0
                  ? and(eq(widgets.pageId, page.id), notInArray(widgets.id, presentWidgetIds))
                  : eq(widgets.pageId, page.id),
              );

            for (const zone of layout.zones) {
              for (const [wi, widget] of zone.widgets.entries()) {
                // Upsert so widgets added in the builder (with a client-generated
                // id) are inserted, while existing ones are updated in place.
                const values = {
                  pageId: page.id,
                  zoneId: zone.id,
                  kind: widget.kind,
                  size: widget.size ?? null,
                  options: widget.options,
                  order: wi,
                };
                await tx
                  .insert(widgets)
                  .values({ id: widget.id, ...values })
                  .onConflictDoUpdate({ target: widgets.id, set: values });
              }
            }
          }),
        catch: (cause) => new DatabaseError({ cause }),
      });

    // Re-points a page at a different layout. Only the page's layout link changes;
    // widget content (keyed by catalog zone) is untouched and re-grouped on next load.
    const setPageLayout = (ref: PageRef, layoutId: string) =>
      Effect.tryPromise({
        try: async () => {
          const page = await ensurePage(ref);
          await db.update(pages).set({ layoutId }).where(eq(pages.id, page.id));
        },
        catch: (cause) => new DatabaseError({ cause }),
      });

    // Admin listing: every page with its layout name and the usernames of whoever
    // created and last edited it. Creator/editor join the user table via separate
    // aliases; both are left joins since createdBy/updatedBy may be null.
    const list = Effect.gen(function* () {
      yield* Policy.canListPages;
      const creator = alias(users, "creator");
      const editor = alias(users, "editor");
      return yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              id: pages.id,
              slug: pages.slug,
              locale: pages.locale,
              title: pages.title,
              layoutName: layouts.name,
              created: pages.created,
              createdByName: creator.username,
              updated: pages.updated,
              updatedByName: editor.username,
            })
            .from(pages)
            .innerJoin(layouts, eq(layouts.id, pages.layoutId))
            .leftJoin(creator, eq(creator.id, pages.createdBy))
            .leftJoin(editor, eq(editor.id, pages.updatedBy))
            .orderBy(desc(pages.created)),
        catch: (cause) => new DatabaseError({ cause }),
      });
    });

    return { getPageLayout, savePageLayout, setPageLayout, list } as const;
  }),
  dependencies: [DatabaseLive],
}) {}

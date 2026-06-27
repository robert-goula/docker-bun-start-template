import { and, asc, desc, eq, isNull, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Data, Effect } from "effect";
import { Database, DatabaseLive } from "@/db/layer";
import { DEFAULT_LAYOUT_NAME, layouts } from "@/db/schema/layouts";
import { DEFAULT_WIDGET_PIN, type LayoutWidget, layoutWidgets } from "@/db/schema/layoutWidgets";
import { type LayoutZoneOptions, layoutZones } from "@/db/schema/layoutZones";
import { DEFAULT_LOCALE, type Locale, pages } from "@/db/schema/pages";
import { sanitizeModules } from "@/lib/meta/registry";
import type { PageMetaData } from "@/lib/meta/types";
import { users } from "@/db/schema/users";
import { widgets } from "@/db/schema/widgets";
import { type ZoneName, zones } from "@/db/schema/zones";
import { MenuCache } from "./MenuCache";
import { Policy } from "./Policy";
import type { WidgetConfig, WidgetKind } from "@/components/Widget";
import type { PageLayout, ZoneConfig, ZoneSize } from "@/components/Zone";

// Projects a layout-default widget row into a renderable WidgetConfig, tagged so the
// page editor renders it read-only (owned by the layout, not the page). `hidden` marks
// defaults this page suppresses — kept in the payload so the editor can restore them,
// but skipped in view mode.
const layoutWidgetToConfig = (w: LayoutWidget, hidden: boolean): WidgetConfig => ({
  id: w.id,
  kind: w.kind as WidgetKind,
  options: (w.options ?? {}) as WidgetConfig["options"],
  content: (w.content ?? null) as WidgetConfig["content"],
  source: "layout",
  hidden,
});

const pinOf = (w: LayoutWidget): string =>
  ((w.options as { pin?: unknown })?.pin as string | undefined) ?? DEFAULT_WIDGET_PIN;

// When a page merges All-locales defaults with its locale's own, the All-locales rows
// (locale IS NULL) take precedence within each pin group, then the locale-specific ones;
// each scope keeps its own `order`. Applied per zone+pin so Top and Bottom both sort
// All-then-locale.
const scopeRank = (w: LayoutWidget): number => (w.locale === null ? 0 : 1);
const byScopeThenOrder = (a: LayoutWidget, b: LayoutWidget): number =>
  scopeRank(a) - scopeRank(b) || a.order - b.order;

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

// A write that would violate the (slug, locale) uniqueness — e.g. renaming a locale's slug
// to one already taken in that locale. Surfaced separately so the fn can answer 409, not 500.
export class ConflictError extends Data.TaggedError("ConflictError")<{
  readonly message: string;
}> {}

// One locale translation of a page: its locale and that locale's own slug. Slugs are
// per-locale now (linked by groupId, not a shared slug), so each sibling carries its slug
// for building locale-correct URLs in the language switcher + hreflang alternates.
export interface PageTranslation {
  readonly locale: Locale;
  readonly slug: string;
}

// Light page metadata for the public route: SEO fields, this page's (canonical) slug, and
// every locale translation in the same group (siblings, for the language switcher + hreflang
// alternates). `modules` is the effective per-module metadata map: the `meta` jsonb column
// plus the basic module (title/description) injected from the columns, so head rendering is
// uniform.
export interface PageMeta {
  readonly meta: { readonly title: string; readonly description: string | null };
  readonly modules: PageMetaData;
  readonly canonicalSlug: string;
  readonly translations: ReadonlyArray<PageTranslation>;
}

// Patch for updatePageMeta: the slug (→ column, per-locale), the basic fields (→ columns)
// and any extension modules (→ jsonb). Slug is normalized/validated by the caller (the fn).
export interface UpdatePageMetaInput {
  readonly slug?: string;
  readonly title?: string;
  readonly description?: string | null;
  readonly modules?: PageMetaData;
}

export class PageRepo extends Effect.Service<PageRepo>()("app/PageRepo", {
  effect: Effect.gen(function* () {
    const db = yield* Database;
    const menuCache = yield* MenuCache;

    // Layout ids resolved by name (cached). New pages link to the requested layout; an
    // unknown name falls back to the default layout so callers can ask for an optional
    // layout (e.g. "admin") without having to guarantee it exists.
    const layoutIdByName = new Map<string, string>();
    const resolveLayoutIdByName = async (name: string): Promise<string> => {
      const cached = layoutIdByName.get(name);
      if (cached) return cached;
      const layout = await db.query.layouts.findFirst({ where: eq(layouts.name, name) });
      if (layout) {
        layoutIdByName.set(name, layout.id);
        return layout.id;
      }
      if (name !== DEFAULT_LAYOUT_NAME) return resolveLayoutIdByName(DEFAULT_LAYOUT_NAME);
      throw new Error(`default layout "${DEFAULT_LAYOUT_NAME}" is missing`);
    };

    // Upserts the page row for a ref, linking new pages to the named layout (default when
    // omitted), and returns it. The link only applies to newly created pages — an existing
    // page keeps its assigned layout (onConflictDoNothing). Page-level arrangement comes
    // from the layout, so nothing else is seeded.
    const ensurePage = async (
      { slug, locale = DEFAULT_LOCALE, title }: PageRef,
      layoutName: string = DEFAULT_LAYOUT_NAME,
    ) => {
      const layoutId = await resolveLayoutIdByName(layoutName);
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

    // Explicit page creation for the admin authoring flow. Same upsert as ensurePage
    // (linked to the default layout), surfaced as a first-class write.
    const createPage = (ref: PageRef) =>
      Effect.tryPromise({
        try: () => ensurePage(ref),
        catch: (cause) => new DatabaseError({ cause }),
      });

    // Adds a translation of an existing page: clones the source locale's title and layout
    // into the target locale (shared slug). No-op if the target locale already exists.
    const createTranslation = (slug: string, fromLocale: Locale, toLocale: Locale) =>
      Effect.tryPromise({
        try: async () => {
          const source = await db.query.pages.findFirst({
            where: and(eq(pages.slug, slug), eq(pages.locale, fromLocale)),
          });
          if (!source) throw new Error(`source page "${slug}" (${fromLocale}) not found`);
          // Seed the translation with the source slug; the admin can localize it afterward.
          // groupId is copied so the new locale is linked to its siblings from the start.
          await db
            .insert(pages)
            .values({
              slug,
              locale: toLocale,
              groupId: source.groupId,
              title: source.title,
              layoutId: source.layoutId,
            })
            .onConflictDoNothing({ target: [pages.slug, pages.locale] });
        },
        catch: (cause) => new DatabaseError({ cause }),
      });

    // Loads a page's layout by (slug, locale): the zone arrangement comes from the
    // page's layout (layoutZone ⋈ zone), the widget content from the page itself.
    const getPageLayout = (ref: PageRef, layoutName?: string) =>
      Effect.tryPromise({
        try: async (): Promise<PageLayout & { layoutId: string }> => {
          const page = await ensurePage(ref, layoutName);

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

          // The layout's default widgets for this locale (plus the all-locales defaults,
          // locale IS NULL). Pinned to the top or bottom of their zone, around the page's
          // own widgets. Suppressed ones stay in the payload tagged `hidden` so the editor
          // can restore them; view-mode rendering skips them.
          const hidden = new Set(page.hiddenLayoutWidgets ?? []);
          const layoutWidgetRows = await db.query.layoutWidgets.findMany({
            where: and(
              eq(layoutWidgets.layoutId, page.layoutId),
              or(eq(layoutWidgets.locale, page.locale), isNull(layoutWidgets.locale)),
            ),
            orderBy: asc(layoutWidgets.order),
          });
          const toLayoutConfig = (w: LayoutWidget) => layoutWidgetToConfig(w, hidden.has(w.id));

          return {
            layoutId: page.layoutId,
            zones: zoneRows.map((zr): ZoneConfig => {
              const opt = (zr.options ?? {}) as LayoutZoneOptions;
              const layoutForZone = layoutWidgetRows
                .filter((w) => w.zoneId === zr.zoneId)
                .sort(byScopeThenOrder);
              return {
                id: zr.zoneId,
                name: zr.name as ZoneName,
                title: opt.title,
                size: opt.size as ZoneSize,
                order: opt.order,
                defaultOpen: opt.defaultOpen,
                widgets: [
                  ...layoutForZone.filter((w) => pinOf(w) !== "bottom").map(toLayoutConfig),
                  ...widgetRows
                    .filter((w) => w.zoneId === zr.zoneId)
                    .map(
                      (w): WidgetConfig => ({
                        id: w.id,
                        kind: w.kind as WidgetKind,
                        options: (w.options ?? {}) as WidgetConfig["options"],
                        content: (w.content ?? null) as WidgetConfig["content"],
                        source: "page",
                      }),
                    ),
                  ...layoutForZone.filter((w) => pinOf(w) === "bottom").map(toLayoutConfig),
                ],
              };
            }),
          };
        },
        catch: (cause) => new DatabaseError({ cause }),
      });

    // Light, read-only metadata resolution for the public page route — title/description
    // for SEO plus the locales this slug exists in (for the language switcher + hreflang).
    // Deliberately does NOT auto-create: an unknown slug returns null so the route can 404.
    // The shared-slug model means siblings share the slug, so the slug is already canonical.
    // NOTE: real CMS resolution (drafts, redirects, aliases) would slot in here.
    const getPageMeta = (ref: PageRef) =>
      Effect.tryPromise({
        try: async (): Promise<PageMeta | null> => {
          const locale = ref.locale ?? DEFAULT_LOCALE;
          const page = await db.query.pages.findFirst({
            where: and(eq(pages.slug, ref.slug), eq(pages.locale, locale)),
            columns: { title: true, description: true, slug: true, meta: true, groupId: true },
          });
          if (!page) return null;

          // Sibling translations share the groupId (slugs are per-locale now); each carries
          // its own slug so callers can build locale-correct URLs.
          const siblings = await db
            .select({ locale: pages.locale, slug: pages.slug })
            .from(pages)
            .where(eq(pages.groupId, page.groupId));

          // Inject the basic module (title/description columns) into the jsonb module map
          // so every module — basic and extension alike — is rendered uniformly downstream.
          const modules: PageMetaData = {
            ...page.meta,
            basic: { title: page.title, description: page.description },
          };

          return {
            meta: { title: page.title, description: page.description },
            modules,
            canonicalSlug: page.slug,
            translations: siblings.map((s) => ({ locale: s.locale as Locale, slug: s.slug })),
          };
        },
        catch: (cause) => new DatabaseError({ cause }),
      });

    // Updates a page's metadata for a (slug, locale): the slug + basic fields write to their
    // columns; extension modules are sanitized against the registry and shallow-merged (per
    // module) into the `meta` jsonb so unrelated modules are preserved. Renaming the slug is
    // guarded against colliding with another page in the same locale (→ ConflictError).
    const updatePageMeta = (ref: PageRef, patch: UpdatePageMetaInput) =>
      Effect.gen(function* () {
        const page = yield* Effect.tryPromise({
          try: () => ensurePage(ref),
          catch: (cause) => new DatabaseError({ cause }),
        });

        const renaming = patch.slug !== undefined && patch.slug !== page.slug;
        if (renaming) {
          const clash = yield* Effect.tryPromise({
            try: () =>
              db.query.pages.findFirst({
                where: and(eq(pages.slug, patch.slug as string), eq(pages.locale, page.locale)),
                columns: { id: true },
              }),
            catch: (cause) => new DatabaseError({ cause }),
          });
          if (clash && clash.id !== page.id) {
            return yield* new ConflictError({
              message: `slug "${patch.slug}" is already used in ${page.locale}`,
            });
          }
        }

        const set: Partial<typeof pages.$inferInsert> = {};
        if (renaming) set.slug = patch.slug;
        if (patch.title !== undefined) set.title = patch.title;
        if (patch.description !== undefined) set.description = patch.description;
        if (patch.modules !== undefined) {
          set.meta = { ...page.meta, ...sanitizeModules(patch.modules) };
        }
        if (Object.keys(set).length === 0) return;

        yield* Effect.tryPromise({
          try: () => db.update(pages).set(set).where(eq(pages.id, page.id)),
          catch: (cause) => new DatabaseError({ cause }),
        });

        // Menus bake in each referenced page's slug + title, so a change to either makes any
        // menu that links this page (via its group) stale. Drop the menu render cache.
        if (set.slug !== undefined || set.title !== undefined) {
          yield* menuCache.invalidate;
        }
      });

    // Persists a page's widget content only. Zone arrangement is owned by the layout
    // and never written here. Widgets are reconciled scoped to the page; the parent
    // zone id (a catalog zone) and array index are the source of truth for placement.
    // Layout-default widgets (source "layout") are merged in on load but owned by the
    // layout, so they're skipped here. `hiddenLayoutWidgets` records which layout
    // defaults this page suppresses (when omitted the existing value is left untouched).
    const savePageLayout = (
      ref: PageRef,
      layout: PageLayout,
      hiddenLayoutWidgets?: ReadonlyArray<string>,
    ) =>
      Effect.tryPromise({
        try: () =>
          db.transaction(async (tx) => {
            const page = await ensurePage(ref);
            // Only the page's own widgets are persisted; layout defaults pass through.
            const pageWidgets = layout.zones.map((z) => ({
              id: z.id,
              widgets: z.widgets.filter((w) => w.source !== "layout"),
            }));
            const presentWidgetIds = pageWidgets.flatMap((z) => z.widgets.map((w) => w.id));

            // Reconcile deletions: drop any of this page's widgets no longer present.
            await tx
              .delete(widgets)
              .where(
                presentWidgetIds.length > 0
                  ? and(eq(widgets.pageId, page.id), notInArray(widgets.id, presentWidgetIds))
                  : eq(widgets.pageId, page.id),
              );

            for (const zone of pageWidgets) {
              for (const [wi, widget] of zone.widgets.entries()) {
                // Upsert so widgets added in the builder (with a client-generated
                // id) are inserted, while existing ones are updated in place.
                const values = {
                  pageId: page.id,
                  zoneId: zone.id,
                  kind: widget.kind,
                  options: widget.options,
                  content: widget.content,
                  order: wi,
                };
                await tx
                  .insert(widgets)
                  .values({ id: widget.id, ...values })
                  .onConflictDoUpdate({ target: widgets.id, set: values });
              }
            }

            if (hiddenLayoutWidgets !== undefined) {
              await tx
                .update(pages)
                .set({ hiddenLayoutWidgets: [...hiddenLayoutWidgets] })
                .where(eq(pages.id, page.id));
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

    // Canonical page list for pickers (e.g. the menu builder): one row per translation
    // group, identified by its default-locale page — the group's `groupId` plus that
    // page's slug/title. A group with no default-locale row is omitted (it has no
    // canonical identity to pick). Admin-gated like `list`.
    const listPageGroups = Effect.gen(function* () {
      yield* Policy.canListPages;
      return yield* Effect.tryPromise({
        try: () =>
          db
            .select({ groupId: pages.groupId, slug: pages.slug, title: pages.title })
            .from(pages)
            .where(eq(pages.locale, DEFAULT_LOCALE))
            .orderBy(asc(pages.title)),
        catch: (cause) => new DatabaseError({ cause }),
      });
    });

    return {
      getPageLayout,
      getPageMeta,
      updatePageMeta,
      createPage,
      createTranslation,
      savePageLayout,
      setPageLayout,
      list,
      listPageGroups,
    } as const;
  }),
  dependencies: [DatabaseLive, MenuCache.Default],
}) {}

import { and, asc, eq, isNull, notInArray, type SQL, sql } from "drizzle-orm";
import { Data, Effect } from "effect";
import { Database, DatabaseLive } from "@/db/layer";
import { type LayoutId } from "@/db/schema/layouts";
import { layoutWidgets } from "@/db/schema/layoutWidgets";
import { type LayoutZoneOptions, layoutZones } from "@/db/schema/layoutZones";
import type { Locale } from "@/db/schema/pages";
import { type ZoneName, zones } from "@/db/schema/zones";
import { CurrentUser } from "./CurrentUser";
import { Policy } from "./Policy";
import type { WidgetConfig, WidgetKind } from "@/components/Widget";
import type { PageLayout, ZoneConfig, ZoneSize } from "@/components/Zone";

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly cause: unknown;
}> {}

// A layout-default widget scope: a layout plus a target locale, or null for the
// all-locales defaults. Routes/fns pass the scope; the repo reads/writes the
// `layoutWidget` rows for exactly that scope.
export type LayoutWidgetScope = { layoutId: LayoutId; locale: Locale | null };

export class LayoutWidgetRepo extends Effect.Service<LayoutWidgetRepo>()("app/LayoutWidgetRepo", {
  effect: Effect.gen(function* () {
    const db = yield* Database;

    // Exact-scope predicate: a set locale matches that locale only; null matches the
    // all-locales rows (locale IS NULL), never the per-locale ones.
    const localeMatch = (locale: Locale | null): SQL | undefined =>
      locale === null ? isNull(layoutWidgets.locale) : eq(layoutWidgets.locale, locale);

    // The layout's zone arrangement (same query pages render with) filled with the
    // layout-default widgets for one scope, shaped as a PageLayout so the admin editor
    // can drive it with the same PageBuilder the page editor uses.
    const getForScope = ({ layoutId, locale }: LayoutWidgetScope) =>
      Effect.gen(function* () {
        yield* Policy.canReadLayout;
        return yield* Effect.tryPromise({
          try: async (): Promise<PageLayout & { layoutId: string }> => {
            const zoneRows = await db
              .select({ zoneId: zones.id, name: zones.name, options: layoutZones.options })
              .from(layoutZones)
              .innerJoin(zones, eq(zones.id, layoutZones.zoneId))
              .where(eq(layoutZones.layoutId, layoutId))
              .orderBy(sql`(${layoutZones.options} ->> 'order')::int`);

            const widgetRows = await db.query.layoutWidgets.findMany({
              where: and(eq(layoutWidgets.layoutId, layoutId), localeMatch(locale)),
              orderBy: asc(layoutWidgets.order),
            });

            return {
              layoutId,
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
                        options: (w.options ?? {}) as WidgetConfig["options"],
                        content: (w.content ?? null) as WidgetConfig["content"],
                        source: "layout",
                      }),
                    ),
                };
              }),
            };
          },
          catch: (cause) => new DatabaseError({ cause }),
        });
      });

    // Reconciles the layout-default widgets for one scope: drops any no longer present,
    // upserts the rest with the array index as order. Mirrors PageRepo.savePageLayout
    // but keyed by (layoutId, locale) instead of page.
    const saveForScope = ({ layoutId, locale }: LayoutWidgetScope, layout: PageLayout) =>
      Effect.gen(function* () {
        yield* Policy.canUpdateLayout;
        const currentUser = yield* CurrentUser;
        yield* Effect.tryPromise({
          try: () =>
            db.transaction(async (tx) => {
              const presentIds = layout.zones.flatMap((z) => z.widgets.map((w) => w.id));
              const scope = and(eq(layoutWidgets.layoutId, layoutId), localeMatch(locale));

              await tx
                .delete(layoutWidgets)
                .where(
                  presentIds.length > 0
                    ? and(scope, notInArray(layoutWidgets.id, presentIds))
                    : scope,
                );

              for (const zone of layout.zones) {
                for (const [wi, widget] of zone.widgets.entries()) {
                  const values = {
                    layoutId,
                    locale,
                    zoneId: zone.id,
                    kind: widget.kind,
                    options: widget.options,
                    content: widget.content,
                    order: wi,
                    updatedBy: currentUser.id,
                  };
                  await tx
                    .insert(layoutWidgets)
                    .values({ id: widget.id, createdBy: currentUser.id, ...values })
                    .onConflictDoUpdate({ target: layoutWidgets.id, set: values });
                }
              }
            }),
          catch: (cause) => new DatabaseError({ cause }),
        });
      });

    return { getForScope, saveForScope } as const;
  }),
  dependencies: [DatabaseLive],
}) {}

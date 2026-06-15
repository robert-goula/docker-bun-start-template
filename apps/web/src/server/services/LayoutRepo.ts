import { and, asc, eq, sql } from "drizzle-orm";
import { Data, Effect } from "effect";
import { Database, DatabaseLive } from "@/db/layer";
import { type LayoutId, layouts } from "@/db/schema/layouts";
import {
  DEFAULT_ZONE_ARRANGEMENT,
  type LayoutZoneOptions,
  layoutZones,
} from "@/db/schema/layoutZones";
import { type ZoneName, zones } from "@/db/schema/zones";
import { CurrentUser } from "./CurrentUser";
import { Policy } from "./Policy";

// Inputs accepted by the repo. `update` carries only the fields that changed; its
// `zones` entries upsert each layout zone's arrangement options by zoneId.
export interface CreateLayoutInput {
  name: string;
  description?: string | null;
}
export interface UpdateLayoutInput {
  name?: string;
  description?: string | null;
  zones?: ReadonlyArray<{ zoneId: string; options: LayoutZoneOptions }>;
}

export class LayoutNotFound extends Data.TaggedError("LayoutNotFound")<{
  readonly id: LayoutId;
}> {}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly cause: unknown;
}> {}

export class LayoutRepo extends Effect.Service<LayoutRepo>()("app/LayoutRepo", {
  effect: Effect.gen(function* () {
    const db = yield* Database;

    const list = Effect.gen(function* () {
      yield* Policy.canListLayouts;
      return yield* Effect.tryPromise({
        try: () => db.query.layouts.findMany({ orderBy: asc(layouts.name) }),
        catch: (cause) => new DatabaseError({ cause }),
      });
    });

    // A layout plus its zone instances (arrangement options + catalog zone name),
    // ordered the same way pages render them.
    const findDetail = (id: LayoutId) =>
      Effect.gen(function* () {
        yield* Policy.canReadLayout;
        const row = yield* Effect.tryPromise({
          try: async () => {
            const layout = await db.query.layouts.findFirst({ where: eq(layouts.id, id) });
            if (!layout) return null;
            const zoneRows = await db
              .select({ zoneId: zones.id, name: zones.name, options: layoutZones.options })
              .from(layoutZones)
              .innerJoin(zones, eq(zones.id, layoutZones.zoneId))
              .where(eq(layoutZones.layoutId, id))
              .orderBy(sql`(${layoutZones.options} ->> 'order')::int`);
            return {
              ...layout,
              zones: zoneRows.map((z) => ({
                zoneId: z.zoneId,
                name: z.name as ZoneName,
                options: (z.options ?? {}) as LayoutZoneOptions,
              })),
            };
          },
          catch: (cause) => new DatabaseError({ cause }),
        });
        if (!row) return yield* Effect.fail(new LayoutNotFound({ id }));
        return row;
      });

    // Creates a layout and seeds an instance of every catalog zone with the default
    // arrangement, so a new layout starts editable with all four zones.
    const create = (input: CreateLayoutInput) =>
      Effect.gen(function* () {
        yield* Policy.canCreateLayout;
        const currentUser = yield* CurrentUser;
        const id = yield* Effect.tryPromise({
          try: () =>
            db.transaction(async (tx) => {
              const rows = await tx
                .insert(layouts)
                .values({
                  name: input.name,
                  description: input.description ?? null,
                  createdBy: currentUser.id,
                })
                .returning({ id: layouts.id });
              const layoutId = rows[0]?.id;
              if (!layoutId) throw new Error("layout insert returned no rows");

              const catalog = await tx.query.zones.findMany();
              const values = catalog.map((z) => ({
                layoutId,
                zoneId: z.id,
                options: DEFAULT_ZONE_ARRANGEMENT[z.name as ZoneName],
                createdBy: currentUser.id,
              }));
              if (values.length > 0) await tx.insert(layoutZones).values(values);
              return layoutId;
            }),
          catch: (cause) => new DatabaseError({ cause }),
        });
        return yield* findDetail(id as LayoutId);
      });

    // Partial update: layout name/description and/or each zone's arrangement options.
    const update = (id: LayoutId, patch: UpdateLayoutInput) =>
      Effect.gen(function* () {
        yield* Policy.canUpdateLayout;
        const currentUser = yield* CurrentUser;

        const exists = yield* Effect.tryPromise({
          try: () => db.query.layouts.findFirst({ where: eq(layouts.id, id) }),
          catch: (cause) => new DatabaseError({ cause }),
        });
        if (!exists) return yield* Effect.fail(new LayoutNotFound({ id }));

        yield* Effect.tryPromise({
          try: () =>
            db.transaction(async (tx) => {
              if (patch.name !== undefined || patch.description !== undefined) {
                const set: Record<string, unknown> = { updatedBy: currentUser.id };
                if (patch.name !== undefined) set.name = patch.name;
                if (patch.description !== undefined) set.description = patch.description;
                await tx.update(layouts).set(set).where(eq(layouts.id, id));
              }
              for (const zone of patch.zones ?? []) {
                await tx
                  .update(layoutZones)
                  .set({ options: zone.options, updatedBy: currentUser.id })
                  .where(and(eq(layoutZones.layoutId, id), eq(layoutZones.zoneId, zone.zoneId)));
              }
            }),
          catch: (cause) => new DatabaseError({ cause }),
        });

        return yield* findDetail(id);
      });

    return { list, findDetail, create, update } as const;
  }),
  dependencies: [DatabaseLive],
}) {}

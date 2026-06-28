import { and, asc, eq, ne, sql } from "drizzle-orm";
import * as z from "zod";
import { layouts } from "@/db/schema/layouts";
import { layoutWidgets } from "@/db/schema/layoutWidgets";
import { layoutZoneOptionsSchema, layoutZones } from "@/db/schema/layoutZones";
import { LOCALES } from "@/db/schema/pages";
import { widgetKinds } from "@/db/schema/widgets";
import { type ZoneName, ZONE_NAMES, zones } from "@/db/schema/zones";
import { jsonSchema } from "@/types/Json";
import { envelope, slugify, type SyncResource, SYNC_VERSION } from "../types";

const bodySchema = z.object({
  kind: z.literal("layout"),
  version: z.literal(SYNC_VERSION),
  id: z.uuid(),
  name: z.string().min(1).max(80),
  description: z.string().max(500).nullish(),
  zones: z.array(z.object({ zone: z.enum(ZONE_NAMES), options: layoutZoneOptionsSchema })),
  widgets: z.array(
    z.object({
      zone: z.enum(ZONE_NAMES),
      locale: z.enum(LOCALES).nullable(),
      kind: z.enum(widgetKinds),
      order: z.number().int(),
      options: z.record(z.string(), z.unknown()).default({}),
      content: jsonSchema.nullish(),
    }),
  ),
});

// Layouts span three tables (`layout` + `layoutZone` + `layoutWidget`). Zones/widgets reference
// the seeded zone catalog by NAME so the file is portable; ids are resolved on import.
export const layoutResource: SyncResource = {
  kind: "layout",
  order: 4,
  async collect(db, key) {
    const rows = await db.query.layouts.findMany({
      where: key ? eq(layouts.name, key) : undefined,
      orderBy: asc(layouts.name),
    });
    const out = [];
    for (const layout of rows) {
      const zoneRows = await db
        .select({ zone: zones.name, options: layoutZones.options })
        .from(layoutZones)
        .innerJoin(zones, eq(zones.id, layoutZones.zoneId))
        .where(eq(layoutZones.layoutId, layout.id))
        .orderBy(sql`(${layoutZones.options} ->> 'order')::int`);
      const widgetRows = await db
        .select({
          zone: zones.name,
          locale: layoutWidgets.locale,
          kind: layoutWidgets.kind,
          order: layoutWidgets.order,
          options: layoutWidgets.options,
          content: layoutWidgets.content,
        })
        .from(layoutWidgets)
        .innerJoin(zones, eq(zones.id, layoutWidgets.zoneId))
        .where(eq(layoutWidgets.layoutId, layout.id))
        .orderBy(asc(zones.name), asc(layoutWidgets.locale), asc(layoutWidgets.order));
      out.push({
        key: slugify(layout.name),
        body: envelope("layout", {
          id: layout.id,
          name: layout.name,
          ...(layout.description ? { description: layout.description } : {}),
          zones: zoneRows,
          widgets: widgetRows.map((w) => ({
            zone: w.zone,
            locale: w.locale,
            kind: w.kind,
            order: w.order,
            options: w.options,
            ...(w.content == null ? {} : { content: w.content }),
          })),
        }),
      });
    }
    return out;
  },
  async apply(db, raw) {
    const doc = bodySchema.parse(raw);
    const description = doc.description ?? null;

    const zoneCatalog = await db.select({ id: zones.id, name: zones.name }).from(zones);
    const zoneIdByName = new Map<ZoneName, string>(
      zoneCatalog.map((row) => [row.name as ZoneName, row.id]),
    );

    await db.transaction(async (tx) => {
      // Committed file wins: drop a different local layout squatting on this name (cascading
      // its zones/widgets) so the unique name index won't block the upsert.
      await tx.delete(layouts).where(and(eq(layouts.name, doc.name), ne(layouts.id, doc.id)));

      await tx
        .insert(layouts)
        .values({ id: doc.id, name: doc.name, description })
        .onConflictDoUpdate({ target: layouts.id, set: { name: doc.name, description } });

      for (const zone of doc.zones) {
        const zoneId = zoneIdByName.get(zone.zone);
        if (!zoneId) throw new Error(`layout ${doc.name}: unknown zone "${zone.zone}"`);
        await tx
          .insert(layoutZones)
          .values({ layoutId: doc.id, zoneId, options: zone.options })
          .onConflictDoUpdate({
            target: [layoutZones.layoutId, layoutZones.zoneId],
            set: { options: zone.options },
          });
      }

      // The file is the source of truth for default widgets: replace them wholesale.
      await tx.delete(layoutWidgets).where(eq(layoutWidgets.layoutId, doc.id));
      if (doc.widgets.length > 0) {
        await tx.insert(layoutWidgets).values(
          doc.widgets.map((w) => {
            const zoneId = zoneIdByName.get(w.zone);
            if (!zoneId) throw new Error(`layout ${doc.name}: unknown zone "${w.zone}"`);
            return {
              layoutId: doc.id,
              zoneId,
              locale: w.locale,
              kind: w.kind,
              order: w.order,
              options: w.options,
              content: w.content ?? null,
            };
          }),
        );
      }
    });
  },
};

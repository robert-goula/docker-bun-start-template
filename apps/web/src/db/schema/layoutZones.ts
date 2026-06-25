import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { index, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { jsonb } from "../jsonb";
import { layouts } from "./layouts";
import { type ZoneName, zoneSizes, zones } from "./zones";

const LayoutZoneIdSchema = z.uuidv7().brand<"LayoutZoneId">();
export type LayoutZoneId = z.infer<typeof LayoutZoneIdSchema>;

// A layout's instance of a catalog zone. `options` carries the arrangement that used
// to live on the per-page zone (title, size, order, defaultOpen).
export const layoutZoneOptionsSchema = z.object({
  title: z.string().min(1).max(255),
  size: z.enum(zoneSizes),
  order: z.number().int(),
  defaultOpen: z.boolean(),
});
export type LayoutZoneOptions = z.infer<typeof layoutZoneOptionsSchema>;

// Canonical zone arrangement seeded into a new layout (and matched by the migration
// for the `default` layout). One entry per catalog zone.
export const DEFAULT_ZONE_ARRANGEMENT: Record<ZoneName, LayoutZoneOptions> = {
  nav: { title: "Nav", size: "full", order: -1, defaultOpen: true },
  hero: { title: "Hero", size: "full", order: 0, defaultOpen: true },
  main: { title: "Main", size: "⅔", order: 1, defaultOpen: true },
  sidebar: { title: "Sidebar", size: "⅓", order: 2, defaultOpen: true },
  footer: { title: "Footer", size: "full", order: 3, defaultOpen: true },
};

export const layoutZones = pgTable(
  "layoutZone",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    layoutId: uuid()
      .notNull()
      .references(() => layouts.id, { onDelete: "cascade" }),
    zoneId: uuid()
      .notNull()
      .references(() => zones.id, { onDelete: "cascade" }),
    options: jsonb("options").notNull().default({}),
    created: timestamp({ precision: 3, withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid(),
    updated: timestamp({ precision: 3, withTimezone: true }).$onUpdate(() => sql`now()`),
    updatedBy: uuid(),
  },
  (t) => ({
    layoutZone_layoutId_idx: index("layoutZone_layoutId_idx").on(t.layoutId),
    layoutZone_layoutId_zoneId_idx: unique("layoutZone_layoutId_zoneId_idx").on(
      t.layoutId,
      t.zoneId,
    ),
  }),
);

export type CreateLayoutZone = InferInsertModel<typeof layoutZones>;
export type LayoutZone = InferSelectModel<typeof layoutZones>;
export type LayoutZones = ReadonlyArray<LayoutZone>;

const insertLayoutZoneBaseSchema = createInsertSchema(layoutZones).omit({
  id: true,
  created: true,
  createdBy: true,
  updated: true,
  updatedBy: true,
});

export const insertLayoutZoneSchema = insertLayoutZoneBaseSchema.extend({
  options: layoutZoneOptionsSchema,
});
export type InsertLayoutZoneInput = z.infer<typeof insertLayoutZoneSchema>;

export const selectLayoutZoneSchema = createSelectSchema(layoutZones).extend({
  options: layoutZoneOptionsSchema,
  created: z.coerce.date(),
  updated: z.coerce.date().nullable(),
});

export const updateLayoutZoneSchema = z
  .object({
    options: layoutZoneOptionsSchema,
  })
  .partial();
export type UpdateLayoutZoneInput = z.infer<typeof updateLayoutZoneSchema>;

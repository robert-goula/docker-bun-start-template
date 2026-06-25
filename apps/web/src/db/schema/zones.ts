import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import * as z from "zod";

// Fixed catalog of placement zones. A zone is identity only (name); its per-layout
// arrangement (title, size, order, defaultOpen) lives on `layoutZone.options`.
export const ZONE_NAMES = ["nav", "hero", "sidebar", "main", "footer"] as const;
export type ZoneName = (typeof ZONE_NAMES)[number];

// Canonical sizing tokens, shared with widgets and layoutZone options to avoid drift.
export const zoneSizes = ["full", "½", "⅓", "⅔", "¼", "¾", "⅕", "⅖", "⅗", "⅘"] as const;
export const DEFAULT_ZONE_SIZE = "full" satisfies (typeof zoneSizes)[number];
export type ZoneSize = (typeof zoneSizes)[number];

const ZoneIdSchema = z.uuidv7().brand<"ZoneId">();
export type ZoneId = z.infer<typeof ZoneIdSchema>;

export const zones = pgTable(
  "zone",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    name: varchar({ length: 40 }).notNull(),
    created: timestamp({ precision: 3, withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid(),
    updated: timestamp({ precision: 3, withTimezone: true }).$onUpdate(() => sql`now()`),
    updatedBy: uuid(),
  },
  (t) => ({
    zone_name_idx: unique("zone_name_idx").on(t.name),
  }),
);

export type CreateZone = InferInsertModel<typeof zones>;
export type Zone = InferSelectModel<typeof zones>;
export type Zones = ReadonlyArray<Zone>;

const insertZoneBaseSchema = createInsertSchema(zones).omit({
  id: true,
  created: true,
  createdBy: true,
  updated: true,
  updatedBy: true,
});

export const insertZoneSchema = insertZoneBaseSchema.extend({
  name: z.enum(ZONE_NAMES),
});
export type InsertZoneInput = z.infer<typeof insertZoneSchema>;

export const selectZoneSchema = createSelectSchema(zones).extend({
  name: z.enum(ZONE_NAMES),
  created: z.coerce.date(),
  updated: z.coerce.date().nullable(),
});

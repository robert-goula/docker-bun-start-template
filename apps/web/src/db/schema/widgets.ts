import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { index, integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { jsonb } from "../jsonb";
import { pages } from "./pages";
import { ZONE_SIZES, zones } from "./zones";

// Known widget kinds. Stored as varchar (not pgEnum) so kinds can grow without a migration.
export const WIDGET_KINDS = [
  "alerts",
  "badges",
  "buttons",
  "cards",
  "fields",
  "headers",
  "markdown",
  "debug",
  "tabsHorizontal",
  "tabsVertical",
  "example",
] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];

const WidgetIdSchema = z.uuidv7().brand<"WidgetId">();
export type WidgetId = z.infer<typeof WidgetIdSchema>;

export const widgets = pgTable(
  "widget",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    pageId: uuid()
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    zoneId: uuid()
      .notNull()
      .references(() => zones.id, { onDelete: "cascade" }),
    kind: varchar({ length: 40 }).notNull(),
    size: varchar({ length: 10 }),
    options: jsonb("options").notNull().default({}),
    order: integer().notNull().default(0),
    created: timestamp({ precision: 3, withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid(),
    updated: timestamp({ precision: 3, withTimezone: true }).$onUpdate(() => sql`now()`),
    updatedBy: uuid(),
  },
  (t) => ({
    widget_pageId_idx: index("widget_pageId_idx").on(t.pageId),
    widget_zoneId_idx: index("widget_zoneId_idx").on(t.zoneId),
  }),
);

export type CreateWidget = InferInsertModel<typeof widgets>;
export type Widget = InferSelectModel<typeof widgets>;
export type Widgets = ReadonlyArray<Widget>;

const insertWidgetBaseSchema = createInsertSchema(widgets).omit({
  id: true,
  created: true,
  createdBy: true,
  updated: true,
  updatedBy: true,
});

export const insertWidgetSchema = insertWidgetBaseSchema.extend({
  kind: z.enum(WIDGET_KINDS),
  size: z.enum(ZONE_SIZES).nullable().optional(),
  options: z.record(z.string(), z.unknown()).default({}),
});
export type InsertWidgetInput = z.infer<typeof insertWidgetSchema>;

export const selectWidgetSchema = createSelectSchema(widgets).extend({
  kind: z.enum(WIDGET_KINDS),
  size: z.enum(ZONE_SIZES).nullable(),
  options: z.record(z.string(), z.unknown()),
  created: z.coerce.date(),
  updated: z.coerce.date().nullable(),
});

export const updateWidgetSchema = z
  .object({
    kind: z.enum(WIDGET_KINDS),
    size: z.enum(ZONE_SIZES).nullable(),
    options: z.record(z.string(), z.unknown()),
    order: z.number().int(),
  })
  .partial();
export type UpdateWidgetInput = z.infer<typeof updateWidgetSchema>;

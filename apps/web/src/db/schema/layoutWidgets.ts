import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { index, integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { type Json, jsonSchema } from "@/types/Json";
import { jsonb } from "../jsonb";
import { LOCALES } from "./pages";
import { widgetKinds } from "./widgets";
import { zones } from "./zones";
import { layouts } from "./layouts";

// Where a layout-default widget sits within its zone, relative to the page's own
// widgets. Stored on `options.pin`; the merge in PageRepo renders pinned-top defaults
// above the page widgets and pinned-bottom defaults below them.
export const widgetPins = ["top", "bottom"] as const;
export type WidgetPin = (typeof widgetPins)[number];
export const DEFAULT_WIDGET_PIN: WidgetPin = "top";

const LayoutWidgetIdSchema = z.uuidv7().brand<"LayoutWidgetId">();
export type LayoutWidgetId = z.infer<typeof LayoutWidgetIdSchema>;

// A default widget defined at the layout level: it appears on every page using the
// layout without being placed per page. Scoped per locale; a null `locale` applies to
// every locale (e.g. a debug panel), while a set locale targets just that one (e.g. a
// localized nav menu). Mirrors the page-scoped `widget` shape (kind/options/content/order)
// so the same renderers and editors work, but is keyed by layout+locale instead of page.
export const layoutWidgets = pgTable(
  "layoutWidget",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    layoutId: uuid()
      .notNull()
      .references(() => layouts.id, { onDelete: "cascade" }),
    // null = applies to every locale; a set locale targets that locale only.
    locale: varchar({ length: 10 }),
    zoneId: uuid()
      .notNull()
      .references(() => zones.id, { onDelete: "cascade" }),
    kind: varchar({ length: 40 }).notNull(),
    options: jsonb("options").notNull().default({}),
    content: jsonb<Json>("content"),
    order: integer().notNull().default(0),
    created: timestamp({ precision: 3, withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid(),
    updated: timestamp({ precision: 3, withTimezone: true }).$onUpdate(() => sql`now()`),
    updatedBy: uuid(),
  },
  (t) => ({
    layoutWidget_layoutId_locale_idx: index("layoutWidget_layoutId_locale_idx").on(
      t.layoutId,
      t.locale,
    ),
    layoutWidget_zoneId_idx: index("layoutWidget_zoneId_idx").on(t.zoneId),
  }),
);

export type CreateLayoutWidget = InferInsertModel<typeof layoutWidgets>;
export type LayoutWidget = InferSelectModel<typeof layoutWidgets>;
export type LayoutWidgets = ReadonlyArray<LayoutWidget>;

const insertLayoutWidgetBaseSchema = createInsertSchema(layoutWidgets).omit({
  id: true,
  created: true,
  createdBy: true,
  updated: true,
  updatedBy: true,
});

export const insertLayoutWidgetSchema = insertLayoutWidgetBaseSchema.extend({
  kind: z.enum(widgetKinds),
  locale: z.enum(LOCALES).nullable(),
  options: z.record(z.string(), z.unknown()).default({}),
  content: jsonSchema.nullable().optional(),
});
export type InsertLayoutWidgetInput = z.infer<typeof insertLayoutWidgetSchema>;

export const selectLayoutWidgetSchema = createSelectSchema(layoutWidgets).extend({
  kind: z.enum(widgetKinds),
  locale: z.enum(LOCALES).nullable(),
  options: z.record(z.string(), z.unknown()),
  content: jsonSchema.nullable(),
  created: z.coerce.date(),
  updated: z.coerce.date().nullable(),
});

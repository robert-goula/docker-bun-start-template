import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import * as z from "zod";

// Every page references a layout for its zone arrangement; new pages get this one.
export const DEFAULT_LAYOUT_NAME = "default";

const LayoutIdSchema = z.uuidv7().brand<"LayoutId">();
export type LayoutId = z.infer<typeof LayoutIdSchema>;

// A named, reusable zone arrangement. `description` is informational only.
export const layouts = pgTable(
  "layout",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    name: varchar({ length: 80 }).notNull(),
    description: varchar({ length: 500 }),
    created: timestamp({ precision: 3, withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid(),
    updated: timestamp({ precision: 3, withTimezone: true }).$onUpdate(() => sql`now()`),
    updatedBy: uuid(),
  },
  (t) => ({
    layout_name_idx: unique("layout_name_idx").on(t.name),
  }),
);

export type CreateLayout = InferInsertModel<typeof layouts>;
export type Layout = InferSelectModel<typeof layouts>;
export type Layouts = ReadonlyArray<Layout>;

const insertLayoutBaseSchema = createInsertSchema(layouts).omit({
  id: true,
  created: true,
  createdBy: true,
  updated: true,
  updatedBy: true,
});

export const insertLayoutSchema = insertLayoutBaseSchema.extend({
  name: z.string().min(1).max(80),
  description: z.string().max(500).nullable().optional(),
});
export type InsertLayoutInput = z.infer<typeof insertLayoutSchema>;

export const selectLayoutSchema = createSelectSchema(layouts).extend({
  created: z.coerce.date(),
  updated: z.coerce.date().nullable(),
});

export const updateLayoutSchema = z
  .object({
    name: z.string().min(1).max(80),
    description: z.string().max(500).nullable(),
  })
  .partial();
export type UpdateLayoutInput = z.infer<typeof updateLayoutSchema>;

import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { layouts } from "./layouts";

export const LOCALES = ["en-us", "es-us"] as const;
export const DEFAULT_LOCALE = "en-us" satisfies (typeof LOCALES)[number];
export type Locale = (typeof LOCALES)[number];

const PageIdSchema = z.uuidv7().brand<"PageId">();
export type PageId = z.infer<typeof PageIdSchema>;

export const pages = pgTable(
  "page",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    slug: varchar({ length: 255 }).notNull(),
    locale: varchar({ length: 10 }).notNull().default(DEFAULT_LOCALE),
    title: varchar({ length: 255 }).notNull(),
    description: varchar({ length: 500 }),
    layoutId: uuid()
      .notNull()
      .references(() => layouts.id),
    created: timestamp({ precision: 3, withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid(),
    updated: timestamp({ precision: 3, withTimezone: true }).$onUpdate(() => sql`now()`),
    updatedBy: uuid(),
  },
  (t) => ({
    page_slug_locale_idx: unique("page_slug_locale_idx").on(t.slug, t.locale),
  }),
);

export type CreatePage = InferInsertModel<typeof pages>;
export type Page = InferSelectModel<typeof pages>;
export type Pages = ReadonlyArray<Page>;

const insertPageBaseSchema = createInsertSchema(pages).omit({
  id: true,
  created: true,
  createdBy: true,
  updated: true,
  updatedBy: true,
});

export const insertPageSchema = insertPageBaseSchema.extend({
  locale: z.enum(LOCALES).default(DEFAULT_LOCALE),
});
export type InsertPageInput = z.infer<typeof insertPageSchema>;

export const selectPageSchema = createSelectSchema(pages).extend({
  locale: z.enum(LOCALES),
  created: z.coerce.date(),
  updated: z.coerce.date().nullable(),
});

export const updatePageSchema = z
  .object({
    slug: z.string().min(1).max(255),
    locale: z.enum(LOCALES),
    title: z.string().min(1).max(255),
    description: z.string().max(500).nullable(),
  })
  .partial();
export type UpdatePageInput = z.infer<typeof updatePageSchema>;

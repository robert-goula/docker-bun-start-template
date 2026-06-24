import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { index, pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import type { PageMetaData } from "@/lib/meta/types";
import { jsonb } from "../jsonb";
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
    // Stable key shared by every locale translation of the same page. The slug is now
    // per-locale (a page may live at /about in en-us and /acerca-de in es-us), so the slug
    // can no longer link translations — groupId does. Siblings, the language switcher, and
    // hreflang alternates all resolve by groupId. New pages get their own group (default);
    // createTranslation copies the source page's groupId.
    groupId: uuid("group_id")
      .notNull()
      .default(sql`uuidv7()`),
    title: varchar({ length: 255 }).notNull(),
    description: varchar({ length: 500 }),
    // Extensible SEO metadata, keyed by module id (Open Graph, Twitter, …). The basic
    // module's fields live in title/description above; everything else lives here. See
    // src/lib/meta. Uses the custom jsonb helper to avoid double-encoding (see ../jsonb).
    meta: jsonb<PageMetaData>("meta").notNull().default({}),
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
    page_group_id_idx: index("page_group_id_idx").on(t.groupId),
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
    // Non-basic metadata modules keyed by module id; validated per-module against the
    // registry before persisting (see src/lib/meta/registry.sanitizeModules).
    meta: z.record(z.string(), z.record(z.string(), z.unknown())),
  })
  .partial();
export type UpdatePageInput = z.infer<typeof updatePageSchema>;

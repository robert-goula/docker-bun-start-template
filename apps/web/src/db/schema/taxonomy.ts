import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { jsonb } from "../jsonb";
import { type Locale } from "./pages";
import { type Json, jsonSchema } from "@/types/Json";

const TaxonomyIdSchema = z.uuidv7().brand<"TaxonomyId">();
export type TaxonomyId = z.infer<typeof TaxonomyIdSchema>;

// Display labels keyed by locale, e.g. { "en-us": "Red", "es-us": "Rojo" }. This holds the
// label for EVERY locale, INCLUDING the default one — never assume `value` is the default-locale
// label. The default-locale entry is just another translation that may be edited independently.
export type TaxonomyLocales = Partial<Record<Locale, string>>;

// A self-referencing tree of lookup terms. Any node can parent a set of child terms,
// nested arbitrarily deep; a single parent ("Colors") yields its children as options for
// selects / datalists / radio / checkbox controls. `parentId` null = a root taxonomy.
export const taxonomies = pgTable(
  "taxonomy",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    // Self-reference. Deleting a parent cascades to its descendants (a clean tree delete).
    parentId: uuid().references((): AnyPgColumn => taxonomies.id, { onDelete: "cascade" }),
    // The canonical, machine-facing value (e.g. "#ff0000", "red", a SKU). Treated as immutable
    // and NOT a display label — it is not the en-us text and not assumed to be any locale. Display
    // labels (incl. the default locale) live in `locales`.
    value: varchar({ length: 255 }).notNull(),
    // Display labels per locale, INCLUDING the default locale (see TaxonomyLocales). Labels are
    // mutable; `value` stays put.
    locales: jsonb<TaxonomyLocales>("locales").notNull().default({}),
    // Arbitrary author-supplied data: string | array | nested object.
    meta: jsonb<Json>("meta").notNull().default({}),
    // Option order within a parent (and among roots).
    sort: integer().notNull().default(0),
    created: timestamp({ precision: 3, withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid(),
    updated: timestamp({ precision: 3, withTimezone: true }).$onUpdate(() => sql`now()`),
    updatedBy: uuid(),
  },
  (t) => ({
    // Primary read path: ordered children of a parent (or ordered roots).
    taxonomy_parentId_sort_idx: index("taxonomy_parentId_sort_idx").on(t.parentId, t.sort),
  }),
);

export type CreateTaxonomy = InferInsertModel<typeof taxonomies>;
export type Taxonomy = InferSelectModel<typeof taxonomies>;
export type Taxonomies = ReadonlyArray<Taxonomy>;

// Locale labels validated loosely (any locale key → string); the column's TS type narrows
// keys to `Locale`. Kept permissive so an unknown locale can't reject an otherwise-valid row.
const localesSchema = z.record(z.string(), z.string().max(255));

const insertTaxonomyBaseSchema = createInsertSchema(taxonomies).omit({
  id: true,
  created: true,
  createdBy: true,
  updated: true,
  updatedBy: true,
});

export const insertTaxonomySchema = insertTaxonomyBaseSchema.extend({
  parentId: z.uuid().nullable().optional(),
  value: z.string().min(1).max(255),
  locales: localesSchema.optional().default({}),
  meta: jsonSchema.optional().default({}),
  sort: z.number().int().optional().default(0),
});
export type InsertTaxonomyInput = z.infer<typeof insertTaxonomySchema>;
// The pre-parse shape callers supply: defaulted fields (locales/meta/sort) are optional.
export type CreateTaxonomyInput = z.input<typeof insertTaxonomySchema>;

export const selectTaxonomySchema = createSelectSchema(taxonomies).extend({
  locales: localesSchema,
  meta: jsonSchema,
  created: z.coerce.date(),
  updated: z.coerce.date().nullable(),
});

export const updateTaxonomySchema = z
  .object({
    parentId: z.uuid().nullable(),
    value: z.string().min(1).max(255),
    locales: localesSchema,
    meta: jsonSchema,
    sort: z.number().int(),
  })
  .partial();
export type UpdateTaxonomyInput = z.infer<typeof updateTaxonomySchema>;

// Resolved, PUBLIC-safe option for one locale: what a select/radio/checkbox control renders.
// `id` is the stored value (stable across renames/translations); `label` is resolved from
// `locales` for the requested locale, falling back to the default locale (then to the canonical
// `value` only as a last resort); `meta` is carried for control-specific use.
export const taxonomyOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  meta: jsonSchema,
});
export type TaxonomyOption = z.infer<typeof taxonomyOptionSchema>;

// ---------------------------------------------------------------------------
// Listing: server-side search, optional parent filter, sorting, pagination.
// ---------------------------------------------------------------------------
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export const ListTaxonomiesInput = z.object({
  search: z.string().trim().max(255).optional(),
  // When provided, restrict to this parent's children; absent → all rows.
  parentId: z.uuid().optional(),
  sortBy: z.enum(["value", "sort", "created"]).default("sort"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
  pageNumber: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((v): v is PageSize => (PAGE_SIZE_OPTIONS as readonly number[]).includes(v), {
      message: `pageSize must be one of ${PAGE_SIZE_OPTIONS.join(", ")}`,
    })
    .default(20),
});
export type ListTaxonomiesParams = z.infer<typeof ListTaxonomiesInput>;

export type ListTaxonomiesPagedMeta = {
  totalCount: number;
  pageCount: number;
  pageNumber: number;
  pageSize: PageSize;
};

// JSON:API query-parameter shape for the browser/REST URL:
//   /api/taxonomy?sort=-created&filter[search]=red&filter[parentId]=<uuid>&page[number]=2&page[size]=50
const SORT_FIELDS = ["value", "sort", "created"] as const;
export const SORT_VALUES = [...SORT_FIELDS, ...SORT_FIELDS.map((f) => `-${f}` as const)] as const;
export type SortValue = (typeof SORT_VALUES)[number];

export const ListTaxonomiesSearch = z.object({
  sort: z.enum(SORT_VALUES).catch("sort").default("sort"),
  filter: z
    .object({ search: z.string().trim().max(255).optional(), parentId: z.uuid().optional() })
    .optional(),
  page: z
    .object({
      number: z.coerce.number().int().min(1).catch(1).default(1),
      size: z.coerce
        .number()
        .int()
        .refine((v): v is PageSize => (PAGE_SIZE_OPTIONS as readonly number[]).includes(v))
        .catch(20)
        .default(20),
    })
    .catch({ number: 1, size: 20 })
    .default({ number: 1, size: 20 }),
});
export type ListTaxonomiesSearchParams = z.infer<typeof ListTaxonomiesSearch>;

// Flatten the JSON:API URL shape into the internal params the repo/RPC expect.
export function toListParams(s: ListTaxonomiesSearchParams): ListTaxonomiesParams {
  const desc = s.sort.startsWith("-");
  const sortBy = (desc ? s.sort.slice(1) : s.sort) as ListTaxonomiesParams["sortBy"];
  return {
    search: s.filter?.search || undefined,
    parentId: s.filter?.parentId,
    sortBy,
    sortDir: desc ? "desc" : "asc",
    pageNumber: s.page.number,
    pageSize: s.page.size as PageSize,
  };
}

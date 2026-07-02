import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import * as z from "zod";

const TenantIdSchema = z.uuidv7().brand<"TenantId">();
export type TenantId = z.infer<typeof TenantIdSchema>;

// A tenant the data model can be partitioned by. A user has one active tenant at a
// time (users.tenantId) and a set they may switch between (users.availableTenants).
// Soft delete: `deleted`/`deletedBy` are null while active; set together on soft delete
// and cleared together on restore. The name is unique only among *active* tenants (see
// the partial index) so a soft-deleted name can be reused.
export const tenants = pgTable(
  "tenant",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    name: varchar({ length: 80 }).notNull(),
    created: timestamp({ precision: 3, withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid(),
    updated: timestamp({ precision: 3, withTimezone: true }).$onUpdate(() => sql`now()`),
    updatedBy: uuid(),
    deleted: timestamp({ precision: 3, withTimezone: true }),
    deletedBy: uuid(),
  },
  (t) => ({
    // Partial unique index: names are unique among active (non-deleted) tenants only.
    tenant_name_active_idx: uniqueIndex("tenant_name_active_idx")
      .on(t.name)
      .where(sql`${t.deleted} is null`),
  }),
);

export type CreateTenant = InferInsertModel<typeof tenants>;
export type Tenant = InferSelectModel<typeof tenants>;
export type Tenants = ReadonlyArray<Tenant>;
export type TenantSummary = Readonly<Pick<Tenant, "id" | "name">>;
export type TenantSummaries = ReadonlyArray<TenantSummary>;

export const selectTenantSchema = createSelectSchema(tenants).extend({
  created: z.coerce.date(),
  updated: z.coerce.date().nullable(),
  deleted: z.coerce.date().nullable(),
});

// Create/update contracts. Name is the only editable field.
const insertTenantBaseSchema = createInsertSchema(tenants).omit({
  id: true,
  created: true,
  createdBy: true,
  updated: true,
  updatedBy: true,
  deleted: true,
  deletedBy: true,
});
export const insertTenantSchema = insertTenantBaseSchema.extend({
  name: z.string().trim().min(1).max(80),
});
export type InsertTenantInput = z.infer<typeof insertTenantSchema>;

export const updateTenantSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
  })
  .partial();
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

// ---------------------------------------------------------------------------
// List: server-side search, sorting, pagination, and an active/deleted status
// filter. Mirrors the `user` entity (see db/schema/users.ts) — two representations:
// the JSON:API URL shape (`ListTenantsSearch`) and the flat repo params
// (`ListTenantsParams`), bridged only by `toListParams`.
// ---------------------------------------------------------------------------
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export const TENANT_STATUSES = ["active", "deleted"] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const ListTenantsInput = z.object({
  search: z.string().trim().max(255).optional(),
  status: z.enum(TENANT_STATUSES).default("active"),
  sortBy: z.enum(["name", "created"]).default("name"),
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
export type ListTenantsParams = z.infer<typeof ListTenantsInput>;

export type ListTenantsPagedMeta = {
  totalCount: number;
  pageCount: number;
  pageNumber: number;
  pageSize: PageSize;
};

const SORT_FIELDS = ["name", "created"] as const;
export const SORT_VALUES = [...SORT_FIELDS, ...SORT_FIELDS.map((f) => `-${f}` as const)] as const;
export type SortValue = (typeof SORT_VALUES)[number];

export const ListTenantsSearch = z.object({
  sort: z.enum(SORT_VALUES).catch("name").default("name"),
  filter: z
    .object({
      search: z.string().trim().max(255).optional(),
      status: z.enum(TENANT_STATUSES).catch("active").optional(),
    })
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
export type ListTenantsSearchParams = z.infer<typeof ListTenantsSearch>;

// Flatten the JSON:API URL shape into the internal params the repo/RPC expect.
export function toListParams(s: ListTenantsSearchParams): ListTenantsParams {
  const desc = s.sort.startsWith("-");
  const sortBy = (desc ? s.sort.slice(1) : s.sort) as ListTenantsParams["sortBy"];
  return {
    search: s.filter?.search || undefined,
    status: s.filter?.status ?? "active",
    sortBy,
    sortDir: desc ? "desc" : "asc",
    pageNumber: s.page.number,
    pageSize: s.page.size as PageSize,
  };
}

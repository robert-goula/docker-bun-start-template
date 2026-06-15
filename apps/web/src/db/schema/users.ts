import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { Redacted } from "effect";

const UserIdSchema = z.uuidv7().brand<"UserId">();
export type UserId = z.infer<typeof UserIdSchema>;

export const users = pgTable(
  "user",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    username: varchar({ length: 40 }).notNull(),
    password: varchar({ length: 255 }),
    firstName: varchar({ length: 20 }),
    lastName: varchar({ length: 20 }),
    email: varchar({ length: 255 }).notNull().unique(),
    roles: text("roles")
      .array()
      .notNull()
      .default(sql`ARRAY['user']::text[]`),
    created: timestamp({ precision: 3, withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid(),
    updated: timestamp({ precision: 3, withTimezone: true }).$onUpdate(() => sql`now()`),
    updatedBy: uuid(),
    locked: boolean().default(false),
    lockedBy: uuid(),
    passwordRehashedAt: timestamp({ precision: 3, withTimezone: true }),
  },
  (t) => ({
    user_username_idx: unique("user_username_idx").on(t.username),
    user_email_idx: unique("user_email_idx").on(t.email),
  }),
);

export type CreateUser = InferInsertModel<typeof users>;
export type User = InferSelectModel<typeof users>;
export type Users = ReadonlyArray<User>;
export type UserSummary = Readonly<Pick<User, "id" | "username" | "email">>;
export type UserSummaries = ReadonlyArray<UserSummary>;
export type RegisterUser = Pick<CreateUser, "username" | "email" | "password">;
const insertUserBaseSchema = createInsertSchema(users).omit({
  id: true,
  created: true,
  createdBy: true,
  updated: true,
  updatedBy: true,
  locked: true,
  lockedBy: true,
});
export const insertUserSchema = insertUserBaseSchema.extend({
  password: (insertUserBaseSchema.shape.password as z.ZodTypeAny)
    .transform((value) => Redacted.make(value as string))
    .meta({ redact: true }),
  email: (insertUserBaseSchema.shape.email as z.ZodTypeAny).meta({ redact: true, pii: true }),
  firstName: (insertUserBaseSchema.shape.firstName as z.ZodTypeAny).meta({
    redact: true,
    pii: true,
  }),
  created: z.coerce.date(),
  updated: z.coerce.date().nullable().optional(),
});

export const selectUserSchema = createSelectSchema(users)
  .extend({
    created: z.coerce.date(),
    updated: z.coerce.date().nullable(),
    passwordRehashedAt: z.coerce.date().nullable(),
  })
  .omit({
    password: true,
    locked: true,
    lockedBy: true,
  });

// Parameters for listing users with server-side search, sorting, and pagination.
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export const ListUsersInput = z.object({
  search: z.string().trim().max(255).optional(),
  sortBy: z.enum(["username", "firstName", "lastName", "email", "created"]).default("created"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  pageNumber: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((v): v is PageSize => (PAGE_SIZE_OPTIONS as readonly number[]).includes(v), {
      message: `pageSize must be one of ${PAGE_SIZE_OPTIONS.join(", ")}`,
    })
    .default(20),
});
export type ListUsersParams = z.infer<typeof ListUsersInput>;

export type ListUsersPagedMeta = {
  totalCount: number;
  pageCount: number;
  pageNumber: number;
  pageSize: PageSize;
};

// ---------------------------------------------------------------------------
// JSON:API query-parameter shape for the browser URL.
//
// JSON:API reserves the `sort`, `filter`, and `page` query-parameter families,
// so the admin page URL is shaped as:
//
//   /admin/users?sort=-created&filter[search]=bob&page[number]=2&page[size]=50
//
// `sort` is a single field with a leading `-` meaning descending (the spec's
// convention). The router's qs serializer turns the nested `filter`/`page`
// objects into the bracket notation above. This shape is the canonical search
// state; `toListParams` flattens it into `ListUsersParams` for the repo/RPC.
// ---------------------------------------------------------------------------
const SORT_FIELDS = ["username", "firstName", "lastName", "email", "created"] as const;
export const SORT_VALUES = [...SORT_FIELDS, ...SORT_FIELDS.map((f) => `-${f}` as const)] as const;
export type SortValue = (typeof SORT_VALUES)[number];

export const ListUsersSearch = z.object({
  sort: z.enum(SORT_VALUES).catch("-created").default("-created"),
  filter: z.object({ search: z.string().trim().max(255).optional() }).optional(),
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
export type ListUsersSearchParams = z.infer<typeof ListUsersSearch>;

// Flatten the JSON:API URL shape into the internal params the repo/RPC expect.
export function toListParams(s: ListUsersSearchParams): ListUsersParams {
  const desc = s.sort.startsWith("-");
  const sortBy = (desc ? s.sort.slice(1) : s.sort) as ListUsersParams["sortBy"];
  return {
    search: s.filter?.search || undefined,
    sortBy,
    sortDir: desc ? "desc" : "asc",
    pageNumber: s.page.number,
    pageSize: s.page.size as PageSize,
  };
}

// Editable, admin-mutable user fields. `.partial()` so a PATCH may carry only
// the fields the user actually changed.
export const updateUserSchema = z
  .object({
    username: z.string().min(1).max(40),
    firstName: z.string().max(20).nullable(),
    lastName: z.string().max(20).nullable(),
    email: z.email().max(255),
    roles: z.array(z.string().min(1)).min(1),
  })
  .partial();
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

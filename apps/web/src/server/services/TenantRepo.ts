import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull } from "drizzle-orm";
import { Data, Effect } from "effect";
import { Database, DatabaseLive } from "@/db/layer";
import {
  tenants,
  type InsertTenantInput,
  type ListTenantsParams,
  type TenantId,
  type TenantSummary,
  type UpdateTenantInput,
} from "@/db/schema/tenants";
import { CurrentUser } from "./CurrentUser";
import { Policy } from "./Policy";

const sortColumns = {
  name: tenants.name,
  created: tenants.created,
} as const;

export class TenantNotFound extends Data.TaggedError("TenantNotFound")<{
  readonly id: TenantId;
}> {}

export class DatabaseError extends Data.TaggedError("TenantDatabaseError")<{
  readonly cause: unknown;
}> {}

// The requested name collides with an existing active tenant (partial unique index).
export class TenantNameConflict extends Data.TaggedError("TenantNameConflict")<{
  readonly name: string;
}> {}

// Permanent delete attempted on a tenant that hasn't been soft-deleted yet.
export class TenantNotDeleted extends Data.TaggedError("TenantNotDeleted")<{
  readonly id: TenantId;
}> {}

// Permanent delete blocked because a user still references the tenant (FK).
export class TenantInUse extends Data.TaggedError("TenantInUse")<{
  readonly id: TenantId;
}> {}

const PG_UNIQUE_VIOLATION = "23505";
const PG_FK_VIOLATION = "23503";
const pgCode = (cause: unknown): string | undefined =>
  typeof cause === "object" && cause !== null ? (cause as { code?: string }).code : undefined;

export class TenantRepo extends Effect.Service<TenantRepo>()("app/TenantRepo", {
  effect: Effect.gen(function* () {
    const db = yield* Database;

    // Name summaries for the given ids, excluding soft-deleted tenants. Callers pass the
    // current user's availableTenants, so no per-row policy gate is needed. A soft-deleted
    // tenant therefore disappears from the tenant switcher even if still listed on a user.
    const listByIds = (ids: ReadonlyArray<TenantId>) =>
      Effect.gen(function* () {
        if (ids.length === 0) return [] as ReadonlyArray<TenantSummary>;
        return yield* Effect.tryPromise({
          try: () =>
            db.query.tenants.findMany({
              where: and(inArray(tenants.id, ids as TenantId[]), isNull(tenants.deleted)),
              columns: { id: true, name: true },
            }),
          catch: (cause) => new DatabaseError({ cause }),
        });
      });

    const list = (params: ListTenantsParams) =>
      Effect.gen(function* () {
        yield* Policy.canListTenants;
        const search = params.search?.trim();
        const statusWhere =
          params.status === "deleted" ? isNotNull(tenants.deleted) : isNull(tenants.deleted);
        const searchWhere = search ? ilike(tenants.name, `%${search}%`) : undefined;
        const where = searchWhere ? and(statusWhere, searchWhere) : statusWhere;
        const column = sortColumns[params.sortBy];
        const orderBy = params.sortDir === "asc" ? asc(column) : desc(column);
        const { pageNumber, pageSize } = params;
        const offset = (pageNumber - 1) * pageSize;
        return yield* Effect.tryPromise({
          try: async () => {
            const [rows, [totals]] = await Promise.all([
              db.query.tenants.findMany({ where, orderBy, limit: pageSize, offset }),
              db.select({ totalCount: count() }).from(tenants).where(where),
            ]);
            return { rows, totalCount: totals?.totalCount ?? 0 };
          },
          catch: (cause) => new DatabaseError({ cause }),
        });
      });

    // Reads any tenant, including soft-deleted (the edit screen needs deleted rows).
    const findById = (id: TenantId) =>
      Effect.gen(function* () {
        yield* Policy.canReadTenant;
        const row = yield* Effect.tryPromise({
          try: () => db.query.tenants.findFirst({ where: eq(tenants.id, id) }),
          catch: (cause) => new DatabaseError({ cause }),
        });
        if (!row) return yield* Effect.fail(new TenantNotFound({ id }));
        return row;
      });

    const create = (input: InsertTenantInput) =>
      Effect.gen(function* () {
        yield* Policy.canCreateTenant;
        const currentUser = yield* CurrentUser;
        const rows = yield* Effect.tryPromise({
          try: () =>
            db.insert(tenants).values({ name: input.name, createdBy: currentUser.id }).returning(),
          catch: (cause) =>
            pgCode(cause) === PG_UNIQUE_VIOLATION
              ? new TenantNameConflict({ name: input.name })
              : new DatabaseError({ cause }),
        });
        const created = rows[0];
        if (!created) {
          return yield* Effect.fail(new DatabaseError({ cause: "insert returned no rows" }));
        }
        return created;
      });

    const update = (id: TenantId, patch: UpdateTenantInput) =>
      Effect.gen(function* () {
        yield* Policy.canUpdateTenant;
        const currentUser = yield* CurrentUser;
        const hasChanges = Object.keys(patch).length > 0;
        const row = yield* Effect.tryPromise({
          try: async () => {
            if (!hasChanges) {
              return db.query.tenants.findFirst({ where: eq(tenants.id, id) });
            }
            const rows = await db
              .update(tenants)
              .set({ ...patch, updatedBy: currentUser.id })
              .where(eq(tenants.id, id))
              .returning();
            return rows[0];
          },
          catch: (cause) =>
            pgCode(cause) === PG_UNIQUE_VIOLATION
              ? new TenantNameConflict({ name: patch.name ?? "" })
              : new DatabaseError({ cause }),
        });
        if (!row) return yield* Effect.fail(new TenantNotFound({ id }));
        return row;
      });

    // Soft delete: stamp deleted/deletedBy. Idempotent — a row that's already deleted is
    // returned unchanged. Only flips rows that are currently active (deleted IS NULL).
    const softDelete = (id: TenantId) =>
      Effect.gen(function* () {
        yield* Policy.canDeleteTenant;
        const currentUser = yield* CurrentUser;
        const rows = yield* Effect.tryPromise({
          try: () =>
            db
              .update(tenants)
              .set({ deleted: new Date(), deletedBy: currentUser.id })
              .where(and(eq(tenants.id, id), isNull(tenants.deleted)))
              .returning(),
          catch: (cause) => new DatabaseError({ cause }),
        });
        const row = rows[0];
        if (row) return row;
        // Nothing flipped: the row is missing or already soft-deleted.
        const existing = yield* Effect.tryPromise({
          try: () => db.query.tenants.findFirst({ where: eq(tenants.id, id) }),
          catch: (cause) => new DatabaseError({ cause }),
        });
        if (!existing) return yield* Effect.fail(new TenantNotFound({ id }));
        return existing;
      });

    // Restore: clear deleted/deletedBy. Can conflict on the partial unique index if an
    // active tenant already holds the name.
    const restore = (id: TenantId) =>
      Effect.gen(function* () {
        yield* Policy.canDeleteTenant;
        const currentUser = yield* CurrentUser;
        const rows = yield* Effect.tryPromise({
          try: () =>
            db
              .update(tenants)
              .set({ deleted: null, deletedBy: null, updatedBy: currentUser.id })
              .where(eq(tenants.id, id))
              .returning(),
          catch: (cause) =>
            pgCode(cause) === PG_UNIQUE_VIOLATION
              ? new TenantNameConflict({ name: "" })
              : new DatabaseError({ cause }),
        });
        const row = rows[0];
        if (!row) return yield* Effect.fail(new TenantNotFound({ id }));
        return row;
      });

    // Hard delete, allowed only once a tenant is soft-deleted. Blocked (TenantInUse) if a
    // user still references it via the tenantId FK.
    const permanentDelete = (id: TenantId) =>
      Effect.gen(function* () {
        yield* Policy.canPermanentlyDeleteTenant;
        const existing = yield* Effect.tryPromise({
          try: () => db.query.tenants.findFirst({ where: eq(tenants.id, id) }),
          catch: (cause) => new DatabaseError({ cause }),
        });
        if (!existing) return yield* Effect.fail(new TenantNotFound({ id }));
        if (!existing.deleted) return yield* Effect.fail(new TenantNotDeleted({ id }));
        yield* Effect.tryPromise({
          try: () => db.delete(tenants).where(eq(tenants.id, id)),
          catch: (cause) =>
            pgCode(cause) === PG_FK_VIOLATION
              ? new TenantInUse({ id })
              : new DatabaseError({ cause }),
        });
        return existing;
      });

    return {
      listByIds,
      list,
      findById,
      create,
      update,
      softDelete,
      restore,
      permanentDelete,
    } as const;
  }),
  dependencies: [DatabaseLive],
}) {}

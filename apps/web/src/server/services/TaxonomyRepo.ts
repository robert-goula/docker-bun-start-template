import { and, asc, count, desc, eq, ilike, isNull } from "drizzle-orm";
import { Data, Effect } from "effect";
import { Database, DatabaseLive } from "@/db/layer";
import { DEFAULT_LOCALE, type Locale } from "@/db/schema/pages";
import {
  taxonomies,
  type InsertTaxonomyInput,
  type ListTaxonomiesParams,
  type TaxonomyId,
  type TaxonomyOption,
  type UpdateTaxonomyInput,
} from "@/db/schema/taxonomy";
import { CurrentUser } from "./CurrentUser";
import { Policy } from "./Policy";

const sortColumns = {
  value: taxonomies.value,
  sort: taxonomies.sort,
  created: taxonomies.created,
} as const;

export class TaxonomyNotFound extends Data.TaggedError("TaxonomyNotFound")<{
  readonly id: TaxonomyId;
}> {}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly cause: unknown;
}> {}

// Children of a parent, ordered by (sort, value); `parentId === null` returns the roots.
const childrenWhere = (parentId: TaxonomyId | null) =>
  parentId === null ? isNull(taxonomies.parentId) : eq(taxonomies.parentId, parentId);

export class TaxonomyRepo extends Effect.Service<TaxonomyRepo>()("app/TaxonomyRepo", {
  effect: Effect.gen(function* () {
    const db = yield* Database;

    const findById = (id: TaxonomyId) =>
      Effect.gen(function* () {
        yield* Policy.canReadTaxonomy;
        const row = yield* Effect.tryPromise({
          try: () => db.query.taxonomies.findFirst({ where: eq(taxonomies.id, id) }),
          catch: (cause) => new DatabaseError({ cause }),
        });
        if (!row) return yield* Effect.fail(new TaxonomyNotFound({ id }));
        return row;
      });

    // Ordered children of a parent (or roots when parentId === null). Primary read for the
    // admin builder; policy-gated.
    const listByParent = (parentId: TaxonomyId | null) =>
      Effect.gen(function* () {
        yield* Policy.canListTaxonomies;
        return yield* Effect.tryPromise({
          try: () =>
            db.query.taxonomies.findMany({
              where: childrenWhere(parentId),
              orderBy: [asc(taxonomies.sort), asc(taxonomies.value)],
            }),
          catch: (cause) => new DatabaseError({ cause }),
        });
      });

    // PUBLIC render projection: NO policy check. Options are needed to render placed widgets
    // on public pages, so this is intentionally readable without auth. Resolves each child's
    // label from `locales` for `locale`, falling back to the default locale, then to the
    // canonical `value` only if no label exists at all. `value` is never assumed to be a label.
    const listForRender = (parentId: TaxonomyId | null, locale: Locale) =>
      Effect.gen(function* () {
        const rows = yield* Effect.tryPromise({
          try: () =>
            db.query.taxonomies.findMany({
              where: childrenWhere(parentId),
              orderBy: [asc(taxonomies.sort), asc(taxonomies.value)],
            }),
          catch: (cause) => new DatabaseError({ cause }),
        });
        return rows.map(
          (row): TaxonomyOption => ({
            id: row.id,
            label: row.locales[locale] ?? row.locales[DEFAULT_LOCALE] ?? row.value,
            meta: row.meta,
          }),
        );
      });

    const list = (params: ListTaxonomiesParams) =>
      Effect.gen(function* () {
        yield* Policy.canListTaxonomies;
        const search = params.search?.trim();
        const where = and(
          search ? ilike(taxonomies.value, `%${search}%`) : undefined,
          params.parentId ? eq(taxonomies.parentId, params.parentId) : undefined,
        );
        const column = sortColumns[params.sortBy];
        const orderBy = params.sortDir === "asc" ? asc(column) : desc(column);
        const { pageNumber, pageSize } = params;
        const offset = (pageNumber - 1) * pageSize;
        return yield* Effect.tryPromise({
          try: async () => {
            const [rows, [totals]] = await Promise.all([
              db.query.taxonomies.findMany({ where, orderBy, limit: pageSize, offset }),
              db.select({ totalCount: count() }).from(taxonomies).where(where),
            ]);
            return { rows, totalCount: totals?.totalCount ?? 0 };
          },
          catch: (cause) => new DatabaseError({ cause }),
        });
      });

    const create = (input: InsertTaxonomyInput) =>
      Effect.gen(function* () {
        yield* Policy.canCreateTaxonomy;
        const currentUser = yield* CurrentUser;
        const rows = yield* Effect.tryPromise({
          try: () =>
            db
              .insert(taxonomies)
              .values({ ...input, createdBy: currentUser.id })
              .returning(),
          catch: (cause) => new DatabaseError({ cause }),
        });
        const created = rows[0];
        if (!created) {
          return yield* Effect.fail(new DatabaseError({ cause: "insert returned no rows" }));
        }
        return created;
      });

    // Policy-gated partial update. `patch` carries only the changed fields; an empty patch is a
    // no-op returning the current row.
    const update = (id: TaxonomyId, patch: UpdateTaxonomyInput) =>
      Effect.gen(function* () {
        yield* Policy.canUpdateTaxonomy;
        const currentUser = yield* CurrentUser;
        const hasChanges = Object.keys(patch).length > 0;
        const row = yield* Effect.tryPromise({
          try: async () => {
            if (!hasChanges) {
              return db.query.taxonomies.findFirst({ where: eq(taxonomies.id, id) });
            }
            const rows = await db
              .update(taxonomies)
              .set({ ...patch, updatedBy: currentUser.id })
              .where(eq(taxonomies.id, id))
              .returning();
            return rows[0];
          },
          catch: (cause) => new DatabaseError({ cause }),
        });
        if (!row) return yield* Effect.fail(new TaxonomyNotFound({ id }));
        return row;
      });

    const remove = (id: TaxonomyId) =>
      Effect.gen(function* () {
        yield* Policy.canDeleteTaxonomy;
        const exists = yield* Effect.tryPromise({
          try: () => db.query.taxonomies.findFirst({ where: eq(taxonomies.id, id) }),
          catch: (cause) => new DatabaseError({ cause }),
        });
        if (!exists) return yield* Effect.fail(new TaxonomyNotFound({ id }));
        // ON DELETE cascade removes descendants in the same statement.
        yield* Effect.tryPromise({
          try: () => db.delete(taxonomies).where(eq(taxonomies.id, id)),
          catch: (cause) => new DatabaseError({ cause }),
        });
        return { id } as const;
      });

    return { findById, listByParent, listForRender, list, create, update, remove } as const;
  }),
  dependencies: [DatabaseLive],
}) {}

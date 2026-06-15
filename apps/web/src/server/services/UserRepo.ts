import { asc, count, desc, eq, ilike, or } from "drizzle-orm";
import { Data, Effect } from "effect";
import { Database, DatabaseLive } from "@/db/layer";
import {
  users,
  type CreateUser,
  type ListUsersParams,
  type UpdateUserInput,
  type UserId,
} from "@/db/schema/users";
import { CurrentUser } from "./CurrentUser";
import { Policy } from "./Policy";

const sortColumns = {
  username: users.username,
  firstName: users.firstName,
  lastName: users.lastName,
  email: users.email,
  created: users.created,
} as const;

export class UserNotFound extends Data.TaggedError("UserNotFound")<{
  readonly id: UserId;
}> {}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly cause: unknown;
}> {}

export class UserRepo extends Effect.Service<UserRepo>()("app/UserRepo", {
  effect: Effect.gen(function* () {
    const db = yield* Database;

    const findById = (id: UserId) =>
      Effect.gen(function* () {
        yield* Policy.canReadUser(id);
        const row = yield* Effect.tryPromise({
          try: () => db.query.users.findFirst({ where: eq(users.id, id) }),
          catch: (cause) => new DatabaseError({ cause }),
        });
        if (!row) return yield* Effect.fail(new UserNotFound({ id }));
        return row;
      });

    const list = (params: ListUsersParams) =>
      Effect.gen(function* () {
        yield* Policy.canListUsers;
        const search = params.search?.trim();
        const where = search
          ? or(ilike(users.username, `%${search}%`), ilike(users.email, `%${search}%`))
          : undefined;
        const column = sortColumns[params.sortBy];
        const orderBy = params.sortDir === "asc" ? asc(column) : desc(column);
        const { pageNumber, pageSize } = params;
        const offset = (pageNumber - 1) * pageSize;
        return yield* Effect.tryPromise({
          try: async () => {
            const [rows, [totals]] = await Promise.all([
              db.query.users.findMany({ where, orderBy, limit: pageSize, offset }),
              db.select({ totalCount: count() }).from(users).where(where),
            ]);
            return { rows, totalCount: totals?.totalCount ?? 0 };
          },
          catch: (cause) => new DatabaseError({ cause }),
        });
      });

    // Not policy-gated — only call from pre-auth contexts (login flow).
    const findByEmail = (email: string) =>
      Effect.tryPromise({
        try: () => db.query.users.findFirst({ where: eq(users.email, email) }),
        catch: (cause) => new DatabaseError({ cause }),
      });

    // Not policy-gated — only call from the auth middleware to hydrate the session user
    // before CurrentUser exists.
    const findByIdInternal = (id: UserId) =>
      Effect.tryPromise({
        try: () => db.query.users.findFirst({ where: eq(users.id, id) }),
        catch: (cause) => new DatabaseError({ cause }),
      });

    // Not policy-gated — called from the login flow after credential verification.
    const updatePasswordHashInternal = (id: UserId, hash: string) =>
      Effect.tryPromise({
        try: () =>
          db
            .update(users)
            .set({ password: hash, passwordRehashedAt: new Date() })
            .where(eq(users.id, id)),
        catch: (cause) => new DatabaseError({ cause }),
      });

    const acknowledgePasswordRehash = (id: UserId) =>
      Effect.gen(function* () {
        yield* Policy.canReadUser(id);
        yield* Effect.tryPromise({
          try: () => db.update(users).set({ passwordRehashedAt: null }).where(eq(users.id, id)),
          catch: (cause) => new DatabaseError({ cause }),
        });
      });

    // Policy-gated partial update. `patch` carries only the fields the caller
    // actually changed; an empty patch is a no-op that returns the current row.
    const update = (id: UserId, patch: UpdateUserInput) =>
      Effect.gen(function* () {
        yield* Policy.canUpdateUser(id);
        const currentUser = yield* CurrentUser;
        const hasChanges = Object.keys(patch).length > 0;
        const row = yield* Effect.tryPromise({
          try: async () => {
            if (!hasChanges) {
              return db.query.users.findFirst({ where: eq(users.id, id) });
            }
            const rows = await db
              .update(users)
              .set({ ...patch, updatedBy: currentUser.id })
              .where(eq(users.id, id))
              .returning();
            return rows[0];
          },
          catch: (cause) => new DatabaseError({ cause }),
        });
        if (!row) return yield* Effect.fail(new UserNotFound({ id }));
        return row;
      });

    const create = (input: CreateUser) =>
      Effect.gen(function* () {
        yield* Policy.canCreateUser;
        const rows = yield* Effect.tryPromise({
          try: () => db.insert(users).values(input).returning(),
          catch: (cause) => new DatabaseError({ cause }),
        });
        const created = rows[0];
        if (!created) {
          return yield* Effect.fail(new DatabaseError({ cause: "insert returned no rows" }));
        }
        return created;
      });

    return {
      findById,
      findByEmail,
      findByIdInternal,
      list,
      create,
      update,
      updatePasswordHashInternal,
      acknowledgePasswordRehash,
    } as const;
  }),
  dependencies: [DatabaseLive],
}) {}

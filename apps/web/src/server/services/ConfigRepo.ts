import { asc, eq } from "drizzle-orm";
import { Data, Effect } from "effect";
import * as z from "zod";
import { parseConfigValue } from "@/config/registry";
import { Database, DatabaseLive } from "@/db/layer";
import { config, type ConfigId } from "@/db/schema/config";
import { CurrentUser } from "./CurrentUser";
import { Policy } from "./Policy";

// What `set` may change. `value` is validated against the key's registry schema (when known)
// before it is written; `description` is an optional reviewer note carried into YAML exports.
export interface SetConfigInput {
  value: unknown;
  description?: string | null;
}

export class ConfigNotFound extends Data.TaggedError("ConfigNotFound")<{
  readonly id: ConfigId;
}> {}

// A value that failed its registry schema (known key) — surfaced to the client as a 400 with
// the offending message, distinct from an unexpected DatabaseError (500).
export class ConfigValidationError extends Data.TaggedError("ConfigValidationError")<{
  readonly id: ConfigId;
  readonly message: string;
}> {}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly cause: unknown;
}> {}

export class ConfigRepo extends Effect.Service<ConfigRepo>()("app/ConfigRepo", {
  effect: Effect.gen(function* () {
    const db = yield* Database;

    const list = Effect.gen(function* () {
      yield* Policy.canReadConfig;
      return yield* Effect.tryPromise({
        try: () => db.query.config.findMany({ orderBy: asc(config.id) }),
        catch: (cause) => new DatabaseError({ cause }),
      });
    });

    const get = (id: ConfigId) =>
      Effect.gen(function* () {
        yield* Policy.canReadConfig;
        const row = yield* Effect.tryPromise({
          try: () => db.query.config.findFirst({ where: eq(config.id, id) }),
          catch: (cause) => new DatabaseError({ cause }),
        });
        if (!row) return yield* Effect.fail(new ConfigNotFound({ id }));
        return row;
      });

    // Upsert by id. Known keys are validated against the registry first (ConfigValidationError);
    // the write itself is a separate step that only raises DatabaseError.
    const set = (id: ConfigId, input: SetConfigInput) =>
      Effect.gen(function* () {
        yield* Policy.canManageConfig;
        const currentUser = yield* CurrentUser;
        const value = yield* Effect.try({
          try: () => parseConfigValue(id, input.value),
          catch: (cause) =>
            new ConfigValidationError({
              id,
              message:
                cause instanceof z.ZodError
                  ? cause.issues.map((i) => i.message).join("; ")
                  : cause instanceof Error
                    ? cause.message
                    : "Invalid config value",
            }),
        });
        const description = input.description ?? null;
        yield* Effect.tryPromise({
          try: () =>
            db
              .insert(config)
              .values({ id, value, description, createdBy: currentUser.id })
              .onConflictDoUpdate({
                target: config.id,
                set: { value, description, updatedBy: currentUser.id },
              }),
          catch: (cause) => new DatabaseError({ cause }),
        });
        return yield* get(id);
      });

    const remove = (id: ConfigId) =>
      Effect.gen(function* () {
        yield* Policy.canManageConfig;
        const exists = yield* Effect.tryPromise({
          try: () => db.query.config.findFirst({ where: eq(config.id, id) }),
          catch: (cause) => new DatabaseError({ cause }),
        });
        if (!exists) return yield* Effect.fail(new ConfigNotFound({ id }));
        yield* Effect.tryPromise({
          try: () => db.delete(config).where(eq(config.id, id)),
          catch: (cause) => new DatabaseError({ cause }),
        });
        return { id } as const;
      });

    // Policy-free read of a public, safe config value (e.g. site.name) for unauthenticated
    // render paths like the page <head>. Returns null when unset; never 404s.
    const getPublicValue = (id: ConfigId) =>
      Effect.tryPromise({
        try: () => db.query.config.findFirst({ where: eq(config.id, id) }),
        catch: (cause) => new DatabaseError({ cause }),
      }).pipe(Effect.map((row) => row?.value ?? null));

    return { list, get, set, remove, getPublicValue } as const;
  }),
  dependencies: [DatabaseLive],
}) {}

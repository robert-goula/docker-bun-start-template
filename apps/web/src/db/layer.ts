import { Config, ConfigError, Context, Effect, Layer, Redacted } from "effect";
import { createDatabase, type AppDatabase } from "./client";

export class Database extends Context.Tag("Database")<Database, AppDatabase>() {}

export const DatabaseLive = Layer.scoped(
  Database,
  Effect.gen(function* () {
    const url = yield* Config.redacted("DATABASE_URL");
    // A blank value still satisfies Config.redacted, but Bun.SQL silently falls back
    // to the default `postgres` user — surfacing as a confusing auth failure instead
    // of a missing-config error. Fail loudly so the real cause is obvious.
    if (Redacted.value(url).trim().length === 0) {
      return yield* Effect.fail(
        ConfigError.InvalidData(
          ["DATABASE_URL"],
          "DATABASE_URL is empty. Start the stack with the environment loaded (e.g. `just dev`); a blank URL makes the driver fall back to the default 'postgres' user and authentication fails.",
        ),
      );
    }
    const { db, sql } = createDatabase(url);
    yield* Effect.addFinalizer(() => Effect.promise(() => sql.close({ timeout: 5 })));
    return db;
  }),
);

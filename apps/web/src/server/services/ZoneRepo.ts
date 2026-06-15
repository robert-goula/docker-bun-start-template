import { asc } from "drizzle-orm";
import { Data, Effect } from "effect";
import { Database, DatabaseLive } from "@/db/layer";
import { zones } from "@/db/schema/zones";
import { Policy } from "./Policy";

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly cause: unknown;
}> {}

export class ZoneRepo extends Effect.Service<ZoneRepo>()("app/ZoneRepo", {
  effect: Effect.gen(function* () {
    const db = yield* Database;

    const list = Effect.gen(function* () {
      yield* Policy.canListZones;
      return yield* Effect.tryPromise({
        try: () => db.query.zones.findMany({ orderBy: asc(zones.name) }),
        catch: (cause) => new DatabaseError({ cause }),
      });
    });

    return { list } as const;
  }),
  dependencies: [DatabaseLive],
}) {}

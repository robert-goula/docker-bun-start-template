import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Effect } from "effect";
import { stringify } from "yaml";
import { Database, DatabaseLive } from "@/db";

// Committed config folder: apps/web/config (one YAML file per config id).
const CONFIG_DIR = path.resolve(import.meta.dir, "../../config");

const program = Effect.gen(function* () {
  const db = yield* Database;
  const rows = yield* Effect.promise(() => db.query.config.findMany());

  yield* Effect.promise(() => mkdir(CONFIG_DIR, { recursive: true }));

  for (const row of rows) {
    // Wrapper carries the id (so import can assert it matches the filename) and the optional
    // reviewer note alongside the value.
    const doc = {
      id: row.id,
      ...(row.description ? { description: row.description } : {}),
      value: row.value,
    };
    yield* Effect.promise(() => writeFile(path.join(CONFIG_DIR, `${row.id}.yaml`), stringify(doc)));
  }

  yield* Effect.log(
    `Exported ${rows.length} config entr${rows.length === 1 ? "y" : "ies"} to ${CONFIG_DIR}`,
  );
});

// `Effect.provide(DatabaseLive)` builds the scoped layer and runs its finalizer (closes the
// Bun SQL pool) so the process exits cleanly — mirrors src/scripts/seed.ts.
Effect.runPromise(program.pipe(Effect.provide(DatabaseLive)))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

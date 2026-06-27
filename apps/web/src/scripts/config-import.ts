import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Effect } from "effect";
import { parse } from "yaml";
import { parseConfigValue } from "@/config/registry";
import { Database, DatabaseLive } from "@/db";
import { config } from "@/db/schema/config";

// Committed config folder: apps/web/config (one YAML file per config id).
const CONFIG_DIR = path.resolve(import.meta.dir, "../../config");

interface ConfigDoc {
  id?: string;
  description?: string | null;
  value: unknown;
}

const program = Effect.gen(function* () {
  const db = yield* Database;

  const files = yield* Effect.promise(() => readdir(CONFIG_DIR).catch(() => [] as string[]));
  const yamlFiles = files.filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

  let count = 0;
  for (const file of yamlFiles) {
    const id = file.replace(/\.ya?ml$/, "");
    const raw = yield* Effect.promise(() => readFile(path.join(CONFIG_DIR, file), "utf8"));
    const doc = parse(raw) as ConfigDoc;

    if (doc.id && doc.id !== id) {
      return yield* Effect.fail(
        new Error(`config file ${file}: id "${doc.id}" does not match filename`),
      );
    }

    // Validate known keys against the registry; unknown keys pass through as free-form jsonb.
    const value = parseConfigValue(id, doc.value);
    const description = doc.description ?? null;

    yield* Effect.promise(() =>
      db
        .insert(config)
        .values({ id, value, description })
        .onConflictDoUpdate({ target: config.id, set: { value, description } }),
    );
    count++;
  }

  yield* Effect.log(`Imported ${count} config entr${count === 1 ? "y" : "ies"} from ${CONFIG_DIR}`);
});

// `Effect.provide(DatabaseLive)` builds the scoped layer and runs its finalizer (closes the
// Bun SQL pool) so the process exits cleanly — mirrors src/scripts/seed.ts.
Effect.runPromise(program.pipe(Effect.provide(DatabaseLive)))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

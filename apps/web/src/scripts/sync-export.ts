import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Effect } from "effect";
import { stringify } from "yaml";
import { Database, DatabaseLive } from "@/db";
import { getResource, syncResources } from "./sync/registry";
import { SYNC_DIR } from "./sync/types";

// Usage: sync-export [kind] [key]
//   (none)            export every kind
//   <kind>            export all of one kind (e.g. "menu")
//   <kind> <key>      export a single instance (e.g. "menu" "main-nav")
const kindArg = process.argv[2];
const keyArg = process.argv[3];

const program = Effect.gen(function* () {
  const db = yield* Database;

  const resources = kindArg ? [getResource(kindArg)].filter((r) => r !== undefined) : syncResources;
  if (kindArg && resources.length === 0) {
    return yield* Effect.fail(new Error(`unknown kind "${kindArg}"`));
  }

  yield* Effect.promise(() => mkdir(SYNC_DIR, { recursive: true }));

  // Write a clean snapshot: remove the stale YAML covered by this selection before writing.
  // Scoped so a targeted export can't wipe unrelated files:
  //   no args      -> clear every *.yaml (deletions in the DB drop their files)
  //   <kind>       -> clear only that kind's files
  //   <kind> <key> -> clear nothing extra; just overwrite the one target
  yield* Effect.promise(async () => {
    if (kindArg && keyArg) return;
    const existing = await readdir(SYNC_DIR).catch(() => [] as string[]);
    const stale = existing.filter(
      (f) => /\.ya?ml$/.test(f) && (!kindArg || f.startsWith(`${kindArg}.`)),
    );
    await Promise.all(stale.map((f) => unlink(path.join(SYNC_DIR, f))));
  });

  let count = 0;
  for (const resource of resources) {
    const docs = yield* Effect.promise(() => resource.collect(db, keyArg));
    for (const doc of docs) {
      yield* Effect.promise(() =>
        writeFile(path.join(SYNC_DIR, `${resource.kind}.${doc.key}.yaml`), stringify(doc.body)),
      );
      count++;
    }
  }

  yield* Effect.log(`Exported ${count} file${count === 1 ? "" : "s"} to ${SYNC_DIR}`);
});

// `Effect.provide(DatabaseLive)` builds the scoped layer and runs its finalizer (closes the
// Bun SQL pool) so the process exits cleanly — mirrors src/scripts/seed.ts.
Effect.runPromise(program.pipe(Effect.provide(DatabaseLive)))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Effect } from "effect";
import { parse } from "yaml";
import { Database, DatabaseLive } from "@/db";
import { getResource } from "./sync/registry";
import { type SyncResource, SYNC_DIR } from "./sync/types";

// Usage: sync-import [kind]   — import every file, or only those of one kind.
const kindArg = process.argv[2];

interface Pending {
  file: string;
  resource: SyncResource;
  body: unknown;
}

const program = Effect.gen(function* () {
  const db = yield* Database;

  const files = yield* Effect.promise(() => readdir(SYNC_DIR).catch(() => [] as string[]));
  const yamlFiles = files.filter((f) => /\.ya?ml$/.test(f));

  // Parse + validate routing for every file up front, so a misnamed/unknown file fails before
  // any write happens.
  const pending: Pending[] = [];
  for (const file of yamlFiles) {
    const prefix = file.slice(0, file.indexOf("."));
    const raw = yield* Effect.promise(() => readFile(path.join(SYNC_DIR, file), "utf8"));
    const body = parse(raw) as { kind?: string };
    const kind = body?.kind;

    if (!kind) {
      return yield* Effect.fail(new Error(`${file}: missing "kind" field`));
    }
    if (kind !== prefix) {
      return yield* Effect.fail(
        new Error(`${file}: kind "${kind}" does not match filename prefix "${prefix}"`),
      );
    }
    if (kindArg && kind !== kindArg) continue;

    const resource = getResource(kind);
    if (!resource) return yield* Effect.fail(new Error(`${file}: unknown kind "${kind}"`));
    pending.push({ file, resource, body });
  }

  // Apply in dependency order (config -> taxonomy -> custom-widget -> menu -> layout).
  pending.sort((a, b) => a.resource.order - b.resource.order);

  const counts = new Map<string, number>();
  for (const { resource, body } of pending) {
    yield* Effect.promise(() => resource.apply(db, body));
    counts.set(resource.kind, (counts.get(resource.kind) ?? 0) + 1);
  }

  const summary =
    [...counts.entries()].map(([k, n]) => `${n} ${k}`).join(", ") || "0 files";
  yield* Effect.log(`Imported ${summary} from ${SYNC_DIR}`);
});

// `Effect.provide(DatabaseLive)` builds the scoped layer and runs its finalizer (closes the
// Bun SQL pool) so the process exits cleanly — mirrors src/scripts/seed.ts.
Effect.runPromise(program.pipe(Effect.provide(DatabaseLive)))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

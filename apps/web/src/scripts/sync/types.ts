import path from "node:path";
import type { AppDatabase } from "@/db";

// The single committed folder holding every exported file, one per resource instance.
// Resolved from this module's location: src/scripts/sync -> apps/web/config.
export const SYNC_DIR = path.resolve(import.meta.dir, "../../../config");

// File-format version stamped into every body. Bump when a kind's on-disk shape changes
// in a breaking way; a resource's `apply` can then branch on the parsed `version`.
export const SYNC_VERSION = 1;

// One exported file: `<kind>.<key>.yaml`. `key` is the human-readable, stable filename
// identity (config id, slug, slugified name); `body` is the full YAML document including
// the `kind`/`version` envelope.
export interface SyncDoc {
  key: string;
  body: Record<string, unknown>;
}

// A registered, round-trippable entity kind. `collect` reads rows -> docs to write;
// `apply` validates one parsed body and upserts it. Both take the drizzle db directly
// (the drivers own the Effect/Database lifecycle) and run their own transactions as needed.
export interface SyncResource {
  // Discriminator token: the first filename segment and the body `kind` field.
  kind: string;
  // Import dependency order (ascending); soft cross-references decide it.
  order: number;
  collect: (db: AppDatabase, key?: string) => Promise<readonly SyncDoc[]>;
  apply: (db: AppDatabase, body: unknown) => Promise<void>;
}

// Wraps a resource's fields in the standard envelope for export.
export const envelope = (kind: string, fields: Record<string, unknown>): Record<string, unknown> => ({
  kind,
  version: SYNC_VERSION,
  ...fields,
});

// url-safe key derived from a human string (mirrors MenuRepo's slugify).
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";

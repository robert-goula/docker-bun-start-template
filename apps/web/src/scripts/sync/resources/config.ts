import { eq } from "drizzle-orm";
import * as z from "zod";
import { parseConfigValue } from "@/config/registry";
import { config } from "@/db/schema/config";
import { envelope, type SyncResource, SYNC_VERSION } from "../types";

const bodySchema = z.object({
  kind: z.literal("config"),
  version: z.literal(SYNC_VERSION),
  id: z.string().min(1).max(120),
  description: z.string().max(300).nullish(),
  value: z.unknown(),
});

// Namespaced key/value settings (`@/db/schema/config`). The dotted `id` is both the natural
// key and the filename key, so `config.plugins.enabled.yaml` round-trips cleanly.
export const configResource: SyncResource = {
  kind: "config",
  order: 0,
  async collect(db, key) {
    const rows = await db.query.config.findMany(key ? { where: eq(config.id, key) } : undefined);
    return rows.map((row) => ({
      key: row.id,
      body: envelope("config", {
        id: row.id,
        ...(row.description ? { description: row.description } : {}),
        value: row.value,
      }),
    }));
  },
  async apply(db, raw) {
    const doc = bodySchema.parse(raw);
    // Validate known keys against the registry; unknown keys pass through as free-form jsonb.
    const value = parseConfigValue(doc.id, doc.value);
    const description = doc.description ?? null;
    await db
      .insert(config)
      .values({ id: doc.id, value, description })
      .onConflictDoUpdate({ target: config.id, set: { value, description } });
  },
};

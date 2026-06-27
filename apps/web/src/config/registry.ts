import * as z from "zod";

// Source of truth for known config keys → their Zod schema. Known keys are validated on
// write/import; any key not listed here is stored as free-form jsonb (passthrough). This is
// React-free so the repo, server fns, and CLI scripts can all import it.
export const configSchemas = {
  // The plugin/control names that are enabled for the pluggable field-control system.
  "plugins.enabled": z.array(z.string()),
} as const;

export type ConfigKey = keyof typeof configSchemas;

// Validate a value for a known key, or pass it through unchanged for unknown keys.
// Throws (ZodError) when a known key's value is malformed.
export function parseConfigValue(id: string, value: unknown): unknown {
  const schema = (configSchemas as Record<string, z.ZodType>)[id];
  return schema ? schema.parse(value) : value;
}

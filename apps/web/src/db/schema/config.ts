import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { jsonb } from "../jsonb";

// Config ids are namespaced, dotted strings (e.g. "plugins.enabled", "site.settings").
// Unlike the rest of the app, this table deliberately uses a string natural key — the id
// *is* the config name — rather than a uuid v7.
const ConfigIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(
    /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/,
    "Use lowercase dotted notation, e.g. plugins.enabled",
  )
  .brand<"ConfigId">();
export type ConfigId = z.infer<typeof ConfigIdSchema>;

// A single namespaced configuration entry. `value` is free-form jsonb; known keys are
// validated against a Zod schema in `@/config/registry` (`parseConfigValue`) before write.
export const config = pgTable("config", {
  id: varchar({ length: 120 }).primaryKey(),
  value: jsonb<unknown>("value").notNull(),
  // Optional human note, surfaced in the exported YAML for reviewers.
  description: varchar({ length: 300 }),
  created: timestamp({ precision: 3, withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid(),
  updated: timestamp({ precision: 3, withTimezone: true }).$onUpdate(() => sql`now()`),
  updatedBy: uuid(),
});

export type CreateConfig = InferInsertModel<typeof config>;
export type Config = InferSelectModel<typeof config>;
export type Configs = ReadonlyArray<Config>;

const insertConfigBaseSchema = createInsertSchema(config).omit({
  created: true,
  createdBy: true,
  updated: true,
  updatedBy: true,
});

export const insertConfigSchema = insertConfigBaseSchema.extend({
  id: ConfigIdSchema,
  value: z.json(),
  description: z.string().max(300).nullable().optional(),
});
export type InsertConfigInput = z.infer<typeof insertConfigSchema>;

export const selectConfigSchema = createSelectSchema(config).extend({
  id: ConfigIdSchema,
  value: z.json(),
  created: z.coerce.date(),
  updated: z.coerce.date().nullable(),
});

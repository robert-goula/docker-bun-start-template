import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { jsonb } from "../jsonb";
import { fieldControls, type FieldControl } from "@/plugins/fieldControls/keys";
import { widgetElements } from "./widgets";

// Re-exported below so existing importers of `fieldControls` from this module keep working.
export { fieldControls };

const CustomWidgetIdSchema = z.uuidv7().brand<"CustomWidgetId">();
export type CustomWidgetId = z.infer<typeof CustomWidgetIdSchema>;

// The semantic type of a field's value. Only "text" for now; the union grows as
// new field kinds (number, boolean, media, …) are added to the builder.
export const fieldTypes = ["text"] as const;
export type FieldType = (typeof fieldTypes)[number];

// How a text field is rendered/edited: a single-line Input or a multi-line Textarea.
// The control set is owned by the plugin layer (the source of truth for which controls
// exist); re-exported here so existing schema/UI importers are unchanged.
export type { FieldControl };

// Hard cap on a repeatable field's instance count. Not "unlimited" — a realistic ceiling
// the builder and the server schema both enforce.
export const repeatItemsCap = 20;

// The fraction granularities a measurement control supports (quarters … thirty-seconds of
// an inch). Shared by every sub-measurement in a measurement field.
export const fractionDenominators = [2, 4, 8, 16, 32] as const;

// One named, labeled sub-measurement of a measurement field. `name` is the machine key written
// into stored content (`{ [name]: decimal }`); `label` is the display text — mirroring the
// field's own name/label split. The default sub-measurements live in `fieldControls/keys.ts`.
export const measureConfigSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Start with a letter; use letters, numbers or underscores"),
  label: z.string().min(1).max(40),
});

// A single field definition within a custom widget. Position in the `fields` array
// is the display/edit order (sortable in the builder). `name` is the stable key an
// instance uses in its content data map; `label` is shown to the editor.
export const customWidgetFieldSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(60)
      .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Start with a letter; use letters, numbers or underscores"),
    label: z.string().min(1).max(80),
    type: z.enum(fieldTypes).default("text"),
    control: z.enum(fieldControls).default("input"),
    required: z.boolean().default(false),
    minlength: z.number().int().nonnegative().optional(),
    maxlength: z.number().int().positive().optional(),
    // Regex source applied to the value (input control only). Validated as a real
    // RegExp at save time so a broken pattern can't be persisted.
    pattern: z.string().max(300).optional(),
    placeholder: z.string().max(200).optional(),
    // Seeded into a new instance's content for this field.
    defaultValue: z.string().max(2000).optional(),
    // Helper text rendered under the control (FieldDescription).
    description: z.string().max(300).optional(),
    // Visible rows for the textarea control only.
    rows: z.number().int().positive().max(50).optional(),
    // Numeric range and decimal precision for the number control only. `precision` is the
    // count of decimal places allowed (0 = integers); it drives the input's step.
    min: z.number().optional(),
    max: z.number().optional(),
    precision: z.number().int().nonnegative().max(10).optional(),
    // Compound "measurement" control config. All sub-measurements share one fraction
    // granularity (`denominator`) and `unit`. `measures` is the ordered set of named/labeled
    // sub-measurements; absent → the defaults in `fieldControls/keys.ts`. The measurement control
    // lives in `plugins/extra/measurement.tsx` (parked, not registered), so this config is dormant.
    denominator: z.union([z.literal(4), z.literal(8), z.literal(16), z.literal(32)]).optional(),
    unit: z.string().max(12).optional(),
    measures: z.array(measureConfigSchema).min(1).max(6).optional(),
    // Repeatable fields (generic, any control). Off → exactly one instance. When on, the
    // instance count is bounded by minItems/maxItems (each capped at `repeatItemsCap`).
    repeatable: z.boolean().default(false),
    minItems: z.number().int().positive().max(repeatItemsCap).optional(),
    maxItems: z.number().int().positive().max(repeatItemsCap).optional(),
  })
  .superRefine((field, ctx) => {
    if (
      field.minlength !== undefined &&
      field.maxlength !== undefined &&
      field.minlength > field.maxlength
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["minlength"],
        message: "minlength cannot exceed maxlength",
      });
    }
    if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
      ctx.addIssue({ code: "custom", path: ["min"], message: "min cannot exceed max" });
    }
    if (
      field.minItems !== undefined &&
      field.maxItems !== undefined &&
      field.minItems > field.maxItems
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["minItems"],
        message: "minItems cannot exceed maxItems",
      });
    }
    if (field.pattern) {
      try {
        new RegExp(field.pattern);
      } catch {
        ctx.addIssue({ code: "custom", path: ["pattern"], message: "Invalid regular expression" });
      }
    }
    if (field.measures) {
      const seen = new Set<string>();
      field.measures.forEach((measure, i) => {
        if (seen.has(measure.name)) {
          ctx.addIssue({
            code: "custom",
            path: ["measures", i, "name"],
            message: `Duplicate measurement name "${measure.name}"`,
          });
        }
        seen.add(measure.name);
      });
    }
  });
export type CustomWidgetField = z.infer<typeof customWidgetFieldSchema>;

// The ordered list of fields stored in the definition's `fields` jsonb column.
// Field names must be unique within a definition (they key the instance data map).
export const customWidgetFieldsSchema = z
  .array(customWidgetFieldSchema)
  .superRefine((fields, ctx) => {
    const seen = new Set<string>();
    fields.forEach((field, i) => {
      if (seen.has(field.name)) {
        ctx.addIssue({
          code: "custom",
          path: [i, "name"],
          message: `Duplicate field name "${field.name}"`,
        });
      }
      seen.add(field.name);
    });
  });

// A reusable, data-authored widget definition. Editors drop "dynamic" widget
// instances bound to one of these (by id) and fill in its fields.
export const customWidgets = pgTable(
  "custom_widget",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    // Human label shown in the picker and admin (e.g. "Headline").
    name: varchar({ length: 80 }).notNull(),
    // Stable machine key; also the lookup key for an optional custom display component.
    slug: varchar({ length: 80 }).notNull(),
    // Selects an optional bespoke view-mode component; falls back to the generic renderer.
    template: varchar({ length: 40 }),
    // Default read-only wrapper element for instances of this definition (a `widgetElements`
    // value). Null → the global default (section). A placement can override via `options.as`.
    element: varchar({ length: 20 }),
    description: varchar({ length: 500 }),
    fields: jsonb<CustomWidgetField[]>("fields").notNull().default([]),
    created: timestamp({ precision: 3, withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid(),
    updated: timestamp({ precision: 3, withTimezone: true }).$onUpdate(() => sql`now()`),
    updatedBy: uuid(),
  },
  (t) => ({
    custom_widget_name_idx: unique("custom_widget_name_idx").on(t.name),
    custom_widget_slug_idx: unique("custom_widget_slug_idx").on(t.slug),
  }),
);

export type CreateCustomWidget = InferInsertModel<typeof customWidgets>;
export type CustomWidget = InferSelectModel<typeof customWidgets>;
export type CustomWidgets = ReadonlyArray<CustomWidget>;

const insertCustomWidgetBaseSchema = createInsertSchema(customWidgets).omit({
  id: true,
  created: true,
  createdBy: true,
  updated: true,
  updatedBy: true,
});

export const insertCustomWidgetSchema = insertCustomWidgetBaseSchema.extend({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(80),
  template: z.string().max(40).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  fields: customWidgetFieldsSchema.default([]),
});
export type InsertCustomWidgetInput = z.infer<typeof insertCustomWidgetSchema>;

export const selectCustomWidgetSchema = createSelectSchema(customWidgets).extend({
  fields: customWidgetFieldsSchema,
  element: z.enum(widgetElements).nullable(),
  created: z.coerce.date(),
  updated: z.coerce.date().nullable(),
});

// Minimal, PUBLIC-safe projection of a definition, used to render placed instances on
// public pages. Carries only what view rendering needs — the bespoke-component key
// (`template`) and each field's name/label/control/type. Intentionally excludes authoring
// metadata (createdBy/updatedBy/timestamps), slug, description, and per-field validation,
// defaults and helper text, none of which view rendering uses.
export const renderCustomWidgetSchema = z.object({
  id: z.string(),
  template: z.string().nullable(),
  element: z.enum(widgetElements).nullable(),
  fields: z.array(
    z.object({
      name: z.string(),
      label: z.string(),
      control: z.enum(fieldControls),
      type: z.enum(fieldTypes),
      // Carried so view rendering can list repeatable values and format compound ones.
      // All public-safe (no validation/defaults/helper text).
      repeatable: z.boolean().optional().default(false),
      denominator: z.union([z.literal(4), z.literal(8), z.literal(16), z.literal(32)]).optional(),
      unit: z.string().optional(),
      measures: z.array(z.object({ name: z.string(), label: z.string() })).optional(),
    }),
  ),
});
export type RenderCustomWidget = z.infer<typeof renderCustomWidgetSchema>;

export const updateCustomWidgetSchema = z
  .object({
    name: z.string().min(1).max(80),
    slug: z.string().min(1).max(80),
    template: z.string().max(40).nullable(),
    element: z.enum(widgetElements).nullable(),
    description: z.string().max(500).nullable(),
    fields: customWidgetFieldsSchema,
  })
  .partial();
export type UpdateCustomWidgetInput = z.infer<typeof updateCustomWidgetSchema>;

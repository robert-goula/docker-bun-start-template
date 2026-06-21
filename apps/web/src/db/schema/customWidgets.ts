import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { jsonb } from "../jsonb";

const CustomWidgetIdSchema = z.uuidv7().brand<"CustomWidgetId">();
export type CustomWidgetId = z.infer<typeof CustomWidgetIdSchema>;

// The semantic type of a field's value. Only "text" for now; the union grows as
// new field kinds (number, boolean, media, …) are added to the builder.
export const fieldTypes = ["text"] as const;
export type FieldType = (typeof fieldTypes)[number];

// How a text field is rendered/edited: a single-line Input or a multi-line Textarea.
export const fieldControls = ["input", "textarea"] as const;
export type FieldControl = (typeof fieldControls)[number];

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
    if (field.pattern) {
      try {
        new RegExp(field.pattern);
      } catch {
        ctx.addIssue({ code: "custom", path: ["pattern"], message: "Invalid regular expression" });
      }
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
  fields: z.array(
    z.object({
      name: z.string(),
      label: z.string(),
      control: z.enum(fieldControls),
      type: z.enum(fieldTypes),
    }),
  ),
});
export type RenderCustomWidget = z.infer<typeof renderCustomWidgetSchema>;

export const updateCustomWidgetSchema = z
  .object({
    name: z.string().min(1).max(80),
    slug: z.string().min(1).max(80),
    template: z.string().max(40).nullable(),
    description: z.string().max(500).nullable(),
    fields: customWidgetFieldsSchema,
  })
  .partial();
export type UpdateCustomWidgetInput = z.infer<typeof updateCustomWidgetSchema>;

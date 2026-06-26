// React-free source of truth for the set of field controls a custom-widget field can use.
// Kept free of any React/client-only imports so the shared DB schema (which validates the
// `fields` jsonb on the server) can import the key tuple without dragging components in.
// The plugin runtime registers a React component against each of these keys; this module
// only declares the keys, their human labels, and the control-specific config inputs the
// builder should render.

// The control keys, as a literal tuple so `z.enum(fieldControls)` keeps its narrow type.
export const fieldControls = ["input", "textarea", "number"] as const;
export type FieldControl = (typeof fieldControls)[number];

// A declarative spec for one control-specific advanced config input. The builder interprets
// these into form inputs, so they stay serializable (no React). `key` is the CustomWidgetField
// property the input edits (e.g. "pattern", "rows"); `width` is a builder grid class. `min`/`max`
// bound the config input itself; `step` allows decimals (use "any") when editing the config value.
export interface AdvancedFieldSpec {
  key: string;
  label: string;
  inputType: "text" | "number";
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number | "any";
  width?: "¼" | "½" | "full";
}

// Pairs each control key with its label and any control-specific advanced inputs. The builder
// dropdown maps over this, and the advanced tab renders each control's `advancedFields`.
export interface FieldControlDescriptor {
  control: FieldControl;
  label: string;
  advancedFields?: ReadonlyArray<AdvancedFieldSpec>;
}

export const fieldControlDescriptors: ReadonlyArray<FieldControlDescriptor> = [
  {
    control: "input",
    label: "Single line (input)",
    advancedFields: [
      {
        key: "pattern",
        label: "Pattern (regex)",
        inputType: "text",
        placeholder: "^[A-Za-z ]+$",
        width: "½",
      },
    ],
  },
  {
    control: "textarea",
    label: "Multi-line (textarea)",
    advancedFields: [{ key: "rows", label: "Rows", inputType: "number", min: 1, width: "¼" }],
  },
  {
    control: "number",
    label: "Number",
    advancedFields: [
      { key: "min", label: "Minimum", inputType: "number", step: "any", width: "¼" },
      { key: "max", label: "Maximum", inputType: "number", step: "any", width: "¼" },
      {
        key: "precision",
        label: "Decimal places",
        inputType: "number",
        min: 0,
        max: 10,
        width: "¼",
      },
    ],
  },
];

export const fieldControlDescriptorByKey: Record<FieldControl, FieldControlDescriptor> =
  Object.fromEntries(fieldControlDescriptors.map((d) => [d.control, d])) as Record<
    FieldControl,
    FieldControlDescriptor
  >;

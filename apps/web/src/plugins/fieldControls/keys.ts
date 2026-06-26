// React-free registry of field-control keys + the small shared config types the server DB schema
// needs. Kept free of any React/client imports so `customWidgets.ts` can import it without dragging
// components into the server bundle. The rich descriptors (labels, advanced inputs, view
// formatters) live with each control module and are composed in `./index`.

// The control keys, as a literal tuple so `z.enum(fieldControls)` keeps its narrow type. Note this
// includes keys for controls that are not registered/surfaced by default.
export const fieldControls = [
  "input",
  "textarea",
  "number",
] as const;
export type FieldControl = (typeof fieldControls)[number];

// One named, labeled sub-measurement of a measurement control: `name` is the machine key written
// into stored content (`{ [name]: decimal }`); `label` is the display text. Mirrors the field's
// own name/label split. Shared by the schema and the (experimental) measurement control.
export interface MeasureConfig {
  name: string;
  label: string;
}

// Default sub-measurements when a measurement field hasn't configured its own.
export const defaultMeasures: ReadonlyArray<MeasureConfig> = [
  { name: "width", label: "Width" },
  { name: "length", label: "Length" },
];

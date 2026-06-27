// Shared, React-free building blocks for control modules: the value coercion helper, the
// advanced-config spec the builder renders, the view-format context, and the descriptor shape.
// Each control module (`./input`, `./number`, …) imports from here and exports its own descriptor.

import type { Json } from "@/types/Json";
import type { FieldControl, MeasureConfig } from "./keys";

// The value contract is `Json`; simple controls work in strings, so coerce on read.
export const asStr = (value: Json | undefined): string =>
  value == null ? "" : typeof value === "string" ? value : String(value);

// A declarative spec for one control-specific advanced config input. The builder interprets these
// into form inputs, so they stay serializable (no React). `key` is the CustomWidgetField property
// the input edits (e.g. "pattern", "rows"); `width` is a builder grid class.
export interface AdvancedFieldOption {
  value: string | number;
  label: string;
}

export interface AdvancedFieldSpec {
  key: string;
  label: string;
  // "text"/"number"/"select" are rendered generically by the builder. "taxonomyParent" is a
  // bespoke branch (a live taxonomy picker) — see CustomWidgetFieldsBuilder.
  inputType: "text" | "number" | "select" | "taxonomyParent";
  // Fixed choices for `inputType: "select"`. A blank "—" option is added by the builder so a
  // select-backed config value stays optional (clearing it sets the field prop to undefined).
  options?: ReadonlyArray<AdvancedFieldOption>;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number | "any";
  width?: "¼" | "½" | "full";
}

// Minimal, React-free shape a `format` hook reads from a field. Kept structural (not the full
// CustomWidgetField) so this module stays free of the schema import.
export interface FieldFormatContext {
  denominator?: number;
  unit?: string;
  measures?: ReadonlyArray<MeasureConfig>;
}

// Pairs a control key with its builder label, its control-specific advanced inputs, and an
// optional view-mode formatter.
export interface FieldControlDescriptor {
  control: FieldControl;
  label: string;
  advancedFields?: ReadonlyArray<AdvancedFieldSpec>;
  // When true, the control does its own multi-value editing for repeatable fields (e.g. a native
  // multi-select), so the framework does NOT wrap it in the generic Add/Remove `RepeatableField`.
  // The control then receives the array value directly and must branch on `field.repeatable`.
  selfRepeats?: boolean;
  // Optional view-mode formatter: turns a stored value (string or structured Json) into display
  // text. May return a multi-line string (rendered with `white-space: pre-line`). React-free so
  // the SSR view path can call it.
  format?: (value: Json, field: FieldFormatContext) => string;
}

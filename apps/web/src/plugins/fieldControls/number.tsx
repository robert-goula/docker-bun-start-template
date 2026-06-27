import { Input } from "@/components/ui/input";
import { asStr, type FieldControlDescriptor } from "./shared";
import type { FieldControlProps, Plugin } from "../types";

// Numeric control. `min`/`max` bound the value; `precision` (decimal places) drives `step`
// (0 → integers only, undefined → "any"). `required` comes from the shared Basic config.
export function NumberControl({ id, field, value, onChange }: FieldControlProps) {
  const str = asStr(value);
  const step = field.precision != null ? 10 ** -field.precision : "any";

  // Native min/max/step only constrain the spinner and form validity — a typed value can still
  // be out of range or have too many decimals. Normalise on blur (not per keystroke, which would
  // snap a value mid-typing): round to `precision` decimals first, then clamp into [min, max] so
  // the stored value respects both.
  function normalizeOnBlur() {
    if (str.trim() === "") return;
    const n = Number.parseFloat(str);
    if (Number.isNaN(n)) return;
    let next = n;
    if (field.precision != null) {
      const factor = 10 ** field.precision;
      next = Math.round(next * factor) / factor;
    }
    if (field.min != null && next < field.min) next = field.min;
    if (field.max != null && next > field.max) next = field.max;
    if (next !== n) onChange(String(next));
  }

  return (
    <Input
      id={id}
      type="number"
      value={str}
      onChange={(e) => onChange(e.target.value)}
      onBlur={normalizeOnBlur}
      required={field.required}
      min={field.min}
      max={field.max}
      step={step}
      placeholder={field.placeholder}
    />
  );
}

export const numberDescriptor: FieldControlDescriptor = {
  control: "number",
  label: "Number",
  advancedFields: [
    { key: "min", label: "Minimum", inputType: "number", step: "any", width: "¼" },
    { key: "max", label: "Maximum", inputType: "number", step: "any", width: "¼" },
    { key: "precision", label: "Decimal places", inputType: "number", min: 0, max: 10, width: "¼" },
  ],
};

export const numberPlugin: Plugin = {
  name: "number",
  setup(api) {
    api.registerFieldControl("number", NumberControl);
  },
};

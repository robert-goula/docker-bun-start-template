// EXTRA — not committed. A compound "measurement" control: one whole-number input + a fraction
// <select> per configured sub-measurement (`field.measures`, each a { name, label }), all sharing
// one `denominator`. The stored value is a structured object keyed by each measure's `name` →
// computed decimal string (e.g. `{ width: "5.375", length: "2.25" }`).
//
// This module is intentionally NOT wired into `../fieldControls/index` or `../setup`, so the
// control never appears in the builder and isn't registered. To enable: add `measurementDescriptor`
// to `fieldControlDescriptors` and `measurementPlugin` to `builtinPlugins` in
// `../fieldControls/index.ts`. Its schema config (measures/denominator/unit) stays dormant in
// `customWidgets.ts` so the control and its formatter remain type-safe while parked.

import { Input } from "@/components/ui/input";
import { defaultMeasures } from "../fieldControls/keys";
import { asStr, type AdvancedFieldSpec, type FieldFormatContext } from "../fieldControls/shared";
import type { FieldControlProps, Plugin } from "../types";
import type { Json } from "@/types/Json";
import s from "./measurement.module.css";

// Measurement is decoupled from the committed control set — its key isn't in `FieldControl` and
// there's no "measures" advanced-input type — so it carries a local descriptor shape (a free
// `control` string). Reconcile with the shared `FieldControlDescriptor` if/when it's committed.
interface MeasurementControlDescriptor {
  control: string;
  label: string;
  advancedFields?: ReadonlyArray<AdvancedFieldSpec>;
  format?: (value: Json, field: FieldFormatContext) => string;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// --- Display formatting (view mode) -----------------------------------------------------------

// Render one stored decimal as whole + nearest fraction at the given denominator, e.g.
// 5.375 @ 8 → "5 3⁄8". `den` falls back to 16 if unset.
export function formatMeasurement(decimal: string, denominator?: number): string {
  if (decimal.trim() === "") return "";
  const n = Number.parseFloat(decimal);
  if (Number.isNaN(n)) return "";
  const den = denominator ?? 16;
  const sign = n < 0 ? "-" : "";
  const ticks = Math.round(Math.abs(n) * den);
  const whole = Math.floor(ticks / den);
  let num = ticks - whole * den;
  if (num === 0) return `${sign}${whole}`;
  const divisor = gcd(num, den);
  const rden = den / divisor;
  num = num / divisor;
  const fraction = `${num}⁄${rden}`; // U+2044 FRACTION SLASH
  return whole === 0 ? `${sign}${fraction}` : `${sign}${whole} ${fraction}`;
}

// Format a stored measurement value (`{ [name]: decimal }`) as stacked "Label: value unit" lines,
// one per configured sub-measurement (empties dropped). Rendered with `white-space: pre-line`.
export function formatMeasurementSet(value: Json, field: FieldFormatContext): string {
  const obj =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, Json>)
      : {};
  const measures = field.measures?.length ? field.measures : defaultMeasures;
  const unit = field.unit ? ` ${field.unit}` : "";
  return measures
    .map((m) => {
      const display = formatMeasurement(asStr(obj[m.name]), field.denominator);
      return display === "" ? "" : `${m.label}: ${display}${unit}`;
    })
    .filter((line) => line !== "")
    .join("\n");
}

// --- Edit control ------------------------------------------------------------------------------

interface Measure {
  whole: string;
  fraction: number; // decimal value of the fractional part, 0 … <1 (e.g. 1⁄8 → 0.125)
}

// Decompose a stored decimal into whole + nearest fraction (as a decimal) at the denominator.
function decompose(decimal: string | undefined, den: number): Measure {
  if (!decimal || decimal.trim() === "") return { whole: "", fraction: 0 };
  const n = Number.parseFloat(decimal);
  if (Number.isNaN(n)) return { whole: "", fraction: 0 };
  const total = Math.round(n * den);
  const whole = Math.floor(total / den);
  return { whole: String(whole), fraction: (total - whole * den) / den };
}

function toDecimal(m: Measure): number {
  const parsed = m.whole.trim() === "" ? 0 : Number.parseInt(m.whole, 10);
  const whole = Number.isNaN(parsed) ? 0 : parsed;
  return whole + m.fraction;
}

// The fraction <select> options for a denominator. Each option's value is the fraction's decimal
// (k/den, exact for the power-of-two denominators used here); the label is the reduced fraction.
function fractionOptions(den: number): Array<{ value: number; label: string }> {
  const opts = [{ value: 0, label: "0" }];
  for (let t = 1; t < den; t++) {
    const g = gcd(t, den);
    opts.push({ value: t / den, label: `${t / g}⁄${den / g}` });
  }
  return opts;
}

export function MeasurementControl({ id, field, value, onChange }: FieldControlProps) {
  const den = field.denominator ?? 16;
  const measures = field.measures?.length ? field.measures : defaultMeasures;
  const options = fractionOptions(den);
  const obj =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, Json>)
      : {};

  // Write one sub-measurement's decimal back into the structured object. A blank whole + zero
  // fraction stores "" (treated as empty) rather than "0", so an untouched measure stays empty.
  function set(name: string, next: Measure) {
    const decimal = next.whole.trim() === "" && next.fraction === 0 ? "" : String(toDecimal(next));
    onChange({ ...obj, [name]: decimal });
  }

  return (
    <div className={s.measurePair}>
      {measures.map((measure, i) => {
        const m = decompose(asStr(obj[measure.name]), den);
        const controlId = i === 0 ? id : `${id}-${i}`;
        return (
          <div key={measure.name} className={s.measureRow}>
            <span className={s.measureLabel}>{measure.label}</span>
            <Input
              id={controlId}
              className={s.whole}
              type="number"
              min={0}
              step={1}
              required={field.required}
              value={m.whole}
              onChange={(e) => set(measure.name, { ...m, whole: e.target.value })}
            />
            <select
              className={s.fraction}
              aria-label={`${measure.label} fraction`}
              value={String(m.fraction)}
              onChange={(e) => set(measure.name, { ...m, fraction: Number(e.target.value) })}
            >
              {options.map((o) => (
                <option key={o.value} value={String(o.value)}>
                  {o.label}
                </option>
              ))}
            </select>
            {field.unit ? <span className={s.unit}>{field.unit}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

// --- Descriptor + plugin (parked; not registered by default) ----------------------------------

export const measurementDescriptor: MeasurementControlDescriptor = {
  control: "measurement",
  label: "Measurement (fractional inches)",
  advancedFields: [
    {
      key: "denominator",
      label: "Fraction",
      inputType: "select",
      width: "¼",
      options: [
        { value: 2, label: "1⁄2" },
        { value: 4, label: "1⁄4" },
        { value: 8, label: "1⁄8" },
        { value: 16, label: "1⁄16" },
        { value: 32, label: "1⁄32" },
      ],
    },
    { key: "unit", label: "Unit", inputType: "text", placeholder: "in", width: "¼" },
    // NOTE: sub-measurement names/labels (`measures`) had a bespoke "measures" builder input that
    // was removed when measurement was decoupled. Re-add it (shared `AdvancedFieldSpec` + builder
    // branch) to make `measures` editable again; for now the control uses `defaultMeasures`.
  ],
  format: formatMeasurementSet,
};

export const measurementPlugin: Plugin = {
  name: "measurement",
  setup(api) {
    api.registerFieldControl("measurement", MeasurementControl);
  },
};

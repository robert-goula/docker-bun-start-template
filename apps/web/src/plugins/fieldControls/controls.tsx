import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FieldControlProps } from "../types";

// Single-line text control. Behaviour lifted verbatim from the former DynamicField ternary
// so required/minlength/maxlength/pattern/placeholder are unchanged.
export function InputControl({ id, field, value, onChange }: FieldControlProps) {
  return (
    <Input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={field.required}
      minLength={field.minlength}
      maxLength={field.maxlength}
      pattern={field.pattern}
      placeholder={field.placeholder}
    />
  );
}

// Numeric control. `min`/`max` bound the value; `precision` (decimal places) drives `step`
// (0 → integers only, undefined → "any"). `required` comes from the shared Basic config.
export function NumberControl({ id, field, value, onChange }: FieldControlProps) {
  const step = field.precision != null ? 10 ** -field.precision : "any";

  // Native min/max only constrain the spinner and form validity — a typed value can still be
  // out of range. Clamp to the configured bounds on blur (not per keystroke, which would snap
  // a value mid-typing) so the stored value respects them.
  function clampOnBlur() {
    if (value.trim() === "") return;
    const n = Number.parseFloat(value);
    if (Number.isNaN(n)) return;
    let clamped = n;
    if (field.min != null && clamped < field.min) clamped = field.min;
    if (field.max != null && clamped > field.max) clamped = field.max;
    if (clamped !== n) onChange(String(clamped));
  }

  return (
    <Input
      id={id}
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={clampOnBlur}
      required={field.required}
      min={field.min}
      max={field.max}
      step={step}
      placeholder={field.placeholder}
    />
  );
}

// Multi-line text control. `rows` is honoured here (textarea-only, as before).
export function TextareaControl({ id, field, value, onChange }: FieldControlProps) {
  return (
    <Textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={field.required}
      minLength={field.minlength}
      maxLength={field.maxlength}
      placeholder={field.placeholder}
      rows={field.rows}
    />
  );
}

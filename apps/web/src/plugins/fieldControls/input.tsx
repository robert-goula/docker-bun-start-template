import { Input } from "@/components/ui/input";
import { asStr, type FieldControlDescriptor } from "./shared";
import type { FieldControlProps, Plugin } from "../types";

// Single-line text control: required/minlength/maxlength/pattern/placeholder.
export function InputControl({ id, field, value, onChange }: FieldControlProps) {
  return (
    <Input
      id={id}
      value={asStr(value)}
      onChange={(e) => onChange(e.target.value)}
      required={field.required}
      minLength={field.minlength}
      maxLength={field.maxlength}
      pattern={field.pattern}
      placeholder={field.placeholder}
    />
  );
}

export const inputDescriptor: FieldControlDescriptor = {
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
};

export const inputPlugin: Plugin = {
  name: "input-field",
  setup(api) {
    api.registerFieldControl("input", InputControl);
  },
};

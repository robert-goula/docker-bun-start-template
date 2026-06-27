import { Textarea } from "@/components/ui/textarea";
import { asStr, type FieldControlDescriptor } from "./shared";
import type { FieldControlProps, Plugin } from "../types";

// Multi-line text control. `rows` is honoured here (textarea-only).
export function TextareaControl({ id, field, value, onChange }: FieldControlProps) {
  return (
    <Textarea
      id={id}
      value={asStr(value)}
      onChange={(e) => onChange(e.target.value)}
      required={field.required}
      minLength={field.minlength}
      maxLength={field.maxlength}
      placeholder={field.placeholder}
      rows={field.rows}
    />
  );
}

export const textareaDescriptor: FieldControlDescriptor = {
  control: "textarea",
  label: "Multi-line (textarea)",
  advancedFields: [{ key: "rows", label: "Rows", inputType: "number", min: 1, width: "¼" }],
};

export const textareaPlugin: Plugin = {
  name: "textarea",
  setup(api) {
    api.registerFieldControl("textarea", TextareaControl);
  },
};

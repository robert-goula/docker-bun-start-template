import { Field, FieldBody, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { MetaFieldsProps } from "../metaEditorRegistry";

/**
 * Editor for the Open Graph module. Controlled: reads string fields off `value` and emits
 * a merged object on change. The worked example of an extension-module editor — copy this
 * shape for Twitter cards / Dublin Core.
 */
export default function OpenGraphFields({ value, onChange }: MetaFieldsProps) {
  const str = (key: string) => (typeof value[key] === "string" ? (value[key] as string) : "");
  const set = (key: string, v: string) => onChange({ ...value, [key]: v });

  return (
    <>
      <Field>
        <FieldLabel htmlFor="og-title">og:title</FieldLabel>
        <FieldBody>
          <Input
            id="og-title"
            value={str("title")}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Falls back to the page title"
          />
        </FieldBody>
      </Field>
      <Field>
        <FieldLabel htmlFor="og-description">og:description</FieldLabel>
        <FieldBody>
          <Textarea
            id="og-description"
            value={str("description")}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
          />
        </FieldBody>
      </Field>
      <Field>
        <FieldLabel htmlFor="og-type">og:type</FieldLabel>
        <FieldBody>
          <Input
            id="og-type"
            value={str("type")}
            onChange={(e) => set("type", e.target.value)}
            placeholder="website"
          />
        </FieldBody>
      </Field>
      <Field>
        <FieldLabel htmlFor="og-image">og:image</FieldLabel>
        <FieldBody>
          <Input
            id="og-image"
            type="url"
            value={str("image")}
            onChange={(e) => set("image", e.target.value)}
            placeholder="https://…"
          />
        </FieldBody>
      </Field>
    </>
  );
}

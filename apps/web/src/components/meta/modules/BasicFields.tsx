import { Field, FieldBody, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * Basic SEO fields (page title + meta description). Rendered directly by PageMetaPanel
 * (not via the lazy editor registry): title is required and maps to a load-bearing column,
 * so it's always shown rather than tucked behind a collapsible module section.
 */
export default function BasicFields({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  hideDescription = false,
}: {
  title: string;
  description: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  // System (admin) pages carry no SEO, so the editor shows only the title.
  hideDescription?: boolean;
}) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="meta-title">Title</FieldLabel>
        <FieldBody>
          <Input
            id="meta-title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            required
          />
        </FieldBody>
      </Field>
      {!hideDescription && (
        <Field>
          <FieldLabel htmlFor="meta-description">Description</FieldLabel>
          <FieldBody>
            <Textarea
              id="meta-description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              rows={2}
              placeholder="Shown in search results and social previews"
            />
          </FieldBody>
        </Field>
      )}
    </>
  );
}

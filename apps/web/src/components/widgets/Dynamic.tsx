import { type ComponentType, useEffect, useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Field, FieldBody, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { customWidgetsRepo } from "@/repositories/customWidgets";
import type { CustomWidgetField, CustomWidgetId } from "@/db/schema/customWidgets";
import type { SafeCustomWidget } from "@/server/fns/customWidgets";
import type { WidgetContentProps } from "@/components/Widget";
import type { Json } from "@/types/Json";
import s from "./Dynamic.module.css";

// Seam for bespoke view-mode renderers. A definition's `template` (e.g. "headline")
// can map to a custom component here; otherwise the generic renderer is used. Empty
// for now — the generic renderer covers every definition.
type DynamicDisplayProps = { definition: SafeCustomWidget; values: Record<string, Json> };
const displayRegistry: Record<string, ComponentType<DynamicDisplayProps>> = {};

const asString = (value: Json | undefined): string =>
  value == null ? "" : typeof value === "string" ? value : String(value);

// The instance's content is a { fieldName: value } map; coerce unknown shapes to {}.
const toDataMap = (content: Json | undefined): Record<string, Json> =>
  content && typeof content === "object" && !Array.isArray(content)
    ? (content as Record<string, Json>)
    : {};

/**
 * The "dynamic" widget kind: an instance of a reusable custom widget definition.
 * The instance stores only a { fieldName: value } map in `content`; the bound
 * definition (looked up by `options.definitionId`) supplies the field set, order,
 * labels and per-field config. Edit mode renders an editor per field; view mode
 * renders the values (generic renderer, or a bespoke one keyed by `template`).
 */
export default function Dynamic({
  options,
  content,
  editing = false,
  onContentChange,
  onEditingChange,
}: WidgetContentProps) {
  const definitionId = options.definitionId as string | undefined;
  const data = toDataMap(content);

  const query = useQuery({
    ...customWidgetsRepo.byId((definitionId ?? "") as CustomWidgetId),
    enabled: !!definitionId,
  });
  const definition = query.data;

  if (!definitionId) {
    return onContentChange ? (
      <p className={s.notice}>This dynamic widget isn’t linked to a definition.</p>
    ) : null;
  }

  if (query.isLoading) {
    return <p className={s.notice}>Loading…</p>;
  }

  // No usable definition (deleted, or unauthorized on a public page — where the GET
  // resolves with a non-widget error body rather than a real definition): fall back to
  // rendering whatever data the instance holds so nothing silently disappears. Guarding
  // on `fields` being an array keeps the renderers below from touching `.fields` on a
  // truthy-but-malformed value.
  if (!definition || !Array.isArray(definition.fields)) {
    return <DynamicFallback data={data} editable={!!onContentChange} />;
  }

  if (editing) {
    return (
      <DynamicEditor
        definition={definition}
        data={data}
        onContentChange={onContentChange}
        onEditingChange={onEditingChange}
      />
    );
  }

  const Custom = definition.template ? displayRegistry[definition.template] : undefined;
  if (Custom) return <Custom definition={definition} values={data} />;

  return <DynamicView definition={definition} values={data} editable={!!onContentChange} />;
}

function DynamicEditor({
  definition,
  data,
  onContentChange,
  onEditingChange,
}: {
  definition: SafeCustomWidget;
  data: Record<string, Json>;
  onContentChange?: (content: Json) => void;
  onEditingChange?: (editing: boolean) => void;
}) {
  const fieldId = useId();
  // Seed the draft from saved data, falling back to each field's defaultValue.
  const seed = useMemo(() => {
    const next: Record<string, string> = {};
    for (const field of definition.fields) {
      next[field.name] =
        field.name in data ? asString(data[field.name]) : (field.defaultValue ?? "");
    }
    return next;
  }, [definition.fields, data]);
  const [draft, setDraft] = useState<Record<string, string>>(seed);

  // Reseed whenever the editor (re)opens against a new definition/data snapshot.
  useEffect(() => setDraft(seed), [seed]);

  function setValue(name: string, value: string) {
    setDraft((prev) => ({ ...prev, [name]: value }));
  }

  function save() {
    onContentChange?.(draft);
    onEditingChange?.(false);
  }

  function cancel() {
    setDraft(seed);
    onEditingChange?.(false);
  }

  return (
    <div className={s.editor}>
      <FieldGroup>
        {definition.fields.map((field) => (
          <DynamicField
            key={field.name}
            id={`${fieldId}-${field.name}`}
            field={field}
            value={draft[field.name] ?? ""}
            onChange={(value) => setValue(field.name, value)}
          />
        ))}
      </FieldGroup>
      <div className={s.actions}>
        <Button onClick={cancel} size="sm" variant="outline">
          Cancel
        </Button>
        <Button disabled={!onContentChange} intent="primary" onClick={save} size="sm">
          Save
        </Button>
      </div>
    </div>
  );
}

function DynamicField({
  id,
  field,
  value,
  onChange,
}: {
  id: string;
  field: CustomWidgetField;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
      <FieldBody>
        {field.control === "textarea" ? (
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
        ) : (
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
        )}
        {field.description ? <FieldDescription>{field.description}</FieldDescription> : null}
      </FieldBody>
    </Field>
  );
}

// Generic view-mode renderer: the definition's fields, in order, as a dl/dt/dd list.
function DynamicView({
  definition,
  values,
  editable,
}: {
  definition: SafeCustomWidget;
  values: Record<string, Json>;
  editable: boolean;
}) {
  const filled = definition.fields.filter((f) => asString(values[f.name]).trim() !== "");
  if (filled.length === 0) {
    return editable ? (
      <p className={s.notice}>No content yet — use the edit icon above to fill in the fields.</p>
    ) : null;
  }
  return (
    <div className={s.view}>
      <FieldGroup>
        {definition.fields.map((field) => {
          const value = asString(values[field.name]);
          if (value.trim() === "") return null;
          return (
            <Field key={field.name}>
              <FieldLabel>{field.label}</FieldLabel>
              <FieldBody>{value}</FieldBody>
            </Field>
          );
        })}
      </FieldGroup>
    </div>
  );
}

// Used when the definition can't be loaded: render raw data entries so content
// is never lost from view.
function DynamicFallback({ data, editable }: { data: Record<string, Json>; editable: boolean }) {
  const entries = Object.entries(data).filter(([, v]) => asString(v).trim() !== "");
  if (entries.length === 0) {
    return editable ? <p className={s.notice}>This widget’s definition is unavailable.</p> : null;
  }
  return (
    <div className={s.view}>
      <FieldGroup>
        {entries.map(([key, value]) => (
          <Field key={key}>
            <FieldLabel>{key}</FieldLabel>
            <FieldBody>{asString(value)}</FieldBody>
          </Field>
        ))}
      </FieldGroup>
    </div>
  );
}

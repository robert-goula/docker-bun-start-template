import { type ComponentType, useEffect, useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DeleteIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, FieldBody, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { bus, getFieldControl, getFieldView } from "@/plugins";
import { fieldControlDescriptorByKey } from "@/plugins/fieldControls";
import type { FieldControlProps } from "@/plugins";
import { customWidgetsRepo } from "@/repositories/customWidgets";
import Headline from "./Headline";
import { repeatItemsCap } from "@/db/schema/customWidgets";
import type {
  CustomWidgetField,
  CustomWidgetId,
  RenderCustomWidget,
} from "@/db/schema/customWidgets";
import type { SafeCustomWidget } from "@/server/fns/customWidgets";
import type { WidgetContentProps } from "@/components/Widget";
import type { Json } from "@/types/Json";
import s from "./Dynamic.module.css";

// Seam for bespoke view-mode renderers. A definition's `template` maps (case-insensitively
// — keys here are lowercase) to a custom component; otherwise the generic renderer is used.
// View-mode components receive only the public render projection (RenderCustomWidget).
export type DynamicDisplayProps = { definition: RenderCustomWidget; values: Record<string, Json> };
const displayRegistry: Record<string, ComponentType<DynamicDisplayProps>> = {
  headline: Headline,
};

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

  if (!definitionId) {
    return onContentChange ? (
      <p className={s.notice}>This dynamic widget isn’t linked to a definition.</p>
    ) : null;
  }

  // Edit mode is admin-only and needs the FULL definition (per-field validation, defaults,
  // …), so it reads the auth-gated `byId`. View mode renders on public pages, so it reads
  // only the public render projection — prefetched in the page loader, so it's present
  // (dehydrated) during SSR and the bound component server-renders.
  return editing ? (
    <DynamicEditLoader
      definitionId={definitionId as CustomWidgetId}
      data={data}
      onContentChange={onContentChange}
      onEditingChange={onEditingChange}
    />
  ) : (
    <DynamicViewLoader
      definitionId={definitionId as CustomWidgetId}
      data={data}
      editable={!!onContentChange}
    />
  );
}

// View path: reads the public render projection (SSR-prefetched) and renders the bound
// custom component, or the generic renderer, or a fallback. `fields` is guarded as an array
// so a missing/malformed definition degrades to the fallback instead of crashing the render.
function DynamicViewLoader({
  definitionId,
  data,
  editable,
}: {
  definitionId: CustomWidgetId;
  data: Record<string, Json>;
  editable: boolean;
}) {
  const { data: definition } = useQuery(customWidgetsRepo.forRender(definitionId));

  if (!definition || !Array.isArray(definition.fields)) {
    return <DynamicFallback data={data} editable={editable} />;
  }

  const Custom = definition.template
    ? displayRegistry[definition.template.toLowerCase()]
    : undefined;
  if (Custom) return <Custom definition={definition} values={data} />;

  return <DynamicView definition={definition} values={data} editable={editable} />;
}

// Edit path (admin only): reads the full, auth-gated definition to build the per-field editor.
function DynamicEditLoader({
  definitionId,
  data,
  onContentChange,
  onEditingChange,
}: {
  definitionId: CustomWidgetId;
  data: Record<string, Json>;
  onContentChange?: (content: Json) => void;
  onEditingChange?: (editing: boolean) => void;
}) {
  const { data: definition, isLoading } = useQuery(customWidgetsRepo.byId(definitionId));

  if (isLoading) {
    return <p className={s.notice}>Loading…</p>;
  }
  if (!definition || !Array.isArray(definition.fields)) {
    return <DynamicFallback data={data} editable />;
  }
  return (
    <DynamicEditor
      definition={definition}
      data={data}
      onContentChange={onContentChange}
      onEditingChange={onEditingChange}
    />
  );
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
  // Seed the draft from saved data, falling back to each field's defaultValue. Values keep their
  // stored shape (string for simple controls, structured Json for compound/repeatable ones).
  const seed = useMemo(() => {
    const next: Record<string, Json> = {};
    for (const field of definition.fields) {
      next[field.name] = field.name in data ? data[field.name] : (field.defaultValue ?? "");
    }
    return next;
  }, [definition.fields, data]);
  const [draft, setDraft] = useState<Record<string, Json>>(seed);

  // Reseed whenever the editor (re)opens against a new definition/data snapshot.
  useEffect(() => setDraft(seed), [seed]);

  function setValue(name: string, value: Json) {
    setDraft((prev) => ({ ...prev, [name]: value }));
  }

  function save() {
    bus.trigger("widget:save", {
      definitionId: definition.id,
      fields: definition.fields,
      values: draft,
    });
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
  value: Json;
  onChange: (value: Json) => void;
}) {
  // Resolve the control component from the plugin registry (input/textarea are built-ins;
  // unknown keys fall back to the input control).
  const Control = getFieldControl(field.control);
  // A `selfRepeats` control (e.g. the multi-select) handles repetition itself, so it isn't wrapped
  // in the generic Add/Remove RepeatableField — it receives the array value directly.
  const selfRepeats = fieldControlDescriptorByKey[field.control]?.selfRepeats ?? false;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
      <FieldBody>
        {field.repeatable && !selfRepeats ? (
          <RepeatableField
            id={id}
            field={field}
            Control={Control}
            value={value}
            onChange={onChange}
          />
        ) : Control ? (
          <Control id={id} field={field} value={value} onChange={onChange} />
        ) : null}
        {field.description ? <FieldDescription>{field.description}</FieldDescription> : null}
      </FieldBody>
    </Field>
  );
}

// Repeat wrapper (edit path). Stores a JSON array of per-instance value strings; each instance
// renders the same resolved control. The control stays unaware of repetition — it still edits a
// single string. Seeds `minItems` (≥1) empty instances; Add stops at `maxItems`, Remove at min.
function RepeatableField({
  id,
  field,
  Control,
  value,
  onChange,
}: {
  id: string;
  field: CustomWidgetField;
  Control: ComponentType<FieldControlProps> | undefined;
  value: Json;
  onChange: (value: Json) => void;
}) {
  const min = Math.max(1, field.minItems ?? 1);
  const max = field.maxItems ?? repeatItemsCap;
  // A repeatable field stores a native array of per-instance values (each itself a string or a
  // structured object). Seed `min` empty instances when there aren't enough yet.
  const decoded: Json[] = Array.isArray(value)
    ? value
    : value == null || value === ""
      ? []
      : [value];
  const items =
    decoded.length < min ? [...decoded, ...Array(min - decoded.length).fill("")] : decoded;

  const commit = (next: Json[]) => onChange(next);

  return (
    <div className={s.repeat}>
      {items.map((item, i) => (
        // Positional identity: the controls are value-controlled, so index keys are safe here.
        // eslint-disable-next-line react/no-array-index-key
        <div key={i} className={s.repeatItem}>
          <div className={s.repeatControl}>
            {Control ? (
              <Control
                id={`${id}-${i}`}
                field={field}
                value={item}
                onChange={(v) => commit(items.map((cur, j) => (j === i ? v : cur)))}
              />
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Remove item"
            disabled={items.length <= min}
            onClick={() => commit(items.filter((_, j) => j !== i))}
          >
            <DeleteIcon />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={items.length >= max}
        onClick={() => commit([...items, ""])}
      >
        Add
      </Button>
    </div>
  );
}

// Turn a stored field value into its display block(s): one per repeated instance (empties
// dropped), or a single block otherwise. Compound controls format via their descriptor's
// `format` hook (which may return a multi-line block, e.g. a measurement's stacked rows);
// others stringify. The stored value keeps its native shape (string or structured Json).
function displayLines(
  field: RenderCustomWidget["fields"][number],
  raw: Json | undefined,
): string[] {
  const descriptor = fieldControlDescriptorByKey[field.control];
  const context = {
    denominator: field.denominator,
    unit: field.unit,
    measures: field.measures,
  };
  const formatOne = (v: Json): string =>
    (descriptor?.format ? descriptor.format(v, context) : asString(v)).trim();

  if (field.repeatable) {
    const items: Json[] = Array.isArray(raw) ? raw : raw == null || raw === "" ? [] : [raw];
    return items.map(formatOne).filter((line) => line !== "");
  }
  const single = formatOne(raw ?? "");
  return single === "" ? [] : [single];
}

// True when a raw stored value carries something to show (string non-empty, or an array with at
// least one non-empty entry). Used to drop empty fields for React-view controls, mirroring the
// `displayLines().length > 0` check the string path uses.
function rawHasValue(raw: Json | undefined): boolean {
  if (Array.isArray(raw)) return raw.some((v) => asString(v).trim() !== "");
  return asString(raw).trim() !== "";
}

// Generic view-mode renderer: the definition's fields, in order, as a dl/dt/dd list. A control may
// register a React view (`getFieldView`) when its stored value needs async/localized resolution
// (e.g. the select control stores an id); otherwise the field formats to string line(s) via the
// descriptor's `format` hook.
function DynamicView({
  definition,
  values,
  editable,
}: {
  definition: RenderCustomWidget;
  values: Record<string, Json>;
  editable: boolean;
}) {
  const rendered = definition.fields
    .map((field) => {
      const raw = values[field.name];
      const View = getFieldView(field.control);
      if (View) return { field, raw, View, lines: null, hasValue: rawHasValue(raw) };
      const lines = displayLines(field, raw);
      return { field, raw, View: null, lines, hasValue: lines.length > 0 };
    })
    .filter((entry) => entry.hasValue);

  if (rendered.length === 0) {
    return editable ? (
      <p className={s.notice}>No content yet — use the edit icon above to fill in the fields.</p>
    ) : null;
  }
  return (
    <div className={s.view}>
      <FieldGroup>
        {rendered.map(({ field, raw, View, lines }) => (
          <Field key={field.name}>
            <FieldLabel>{field.label}</FieldLabel>
            <FieldBody>
              {View ? (
                <span className={s.preline}>
                  <View field={field} value={raw} />
                </span>
              ) : lines && lines.length === 1 ? (
                <span className={s.preline}>{lines[0]}</span>
              ) : (
                <ul className={s.repeatList}>
                  {(lines ?? []).map((line, i) => (
                    // Display-only list of formatted blocks; index keys are fine.
                    // eslint-disable-next-line react/no-array-index-key
                    <li key={i} className={s.preline}>
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </FieldBody>
          </Field>
        ))}
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

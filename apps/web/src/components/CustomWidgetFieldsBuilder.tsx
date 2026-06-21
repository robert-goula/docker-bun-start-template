import { Activity, useCallback, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import {
  closestCenter,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cx } from "class-variance-authority";
import { DeleteIcon, DragIndicatorIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, FieldBody, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type CustomWidgetField, fieldControls } from "@/db/schema/customWidgets";
import s from "./CustomWidgetFieldsBuilder.module.css";

// Each row carries a stable internal id so drag/keys survive while the editable
// `name` is still being typed. The id is never persisted. `saved` is the last
// persisted version of this row (null for rows added since the last save), used to
// flag which rows are dirty.
interface FieldRowState {
  id: string;
  field: CustomWidgetField;
  saved: CustomWidgetField | null;
}

interface CustomWidgetFieldsBuilderProps {
  initialFields: ReadonlyArray<CustomWidgetField>;
  // Persist the current field list. Resolves `true` on success (the builder then
  // re-baselines and clears its dirty markers) or `false` on a validation/save
  // failure (the draft and dirty markers are kept so the user can retry).
  onSave: (fields: CustomWidgetField[]) => Promise<boolean>;
}

const numOrUndef = (value: string): number | undefined => {
  if (value.trim() === "") return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
};

// CustomWidgetField is flat (every value is a primitive), so a key-union shallow
// compare is a complete equality check.
function fieldsEqual(a: CustomWidgetField, b: CustomWidgetField): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key as keyof CustomWidgetField] !== b[key as keyof CustomWidgetField]) return false;
  }
  return true;
}

function listEqual(
  a: ReadonlyArray<CustomWidgetField>,
  b: ReadonlyArray<CustomWidgetField>,
): boolean {
  return a.length === b.length && a.every((field, i) => fieldsEqual(field, b[i]));
}

function makeField(index: number): CustomWidgetField {
  return {
    name: `field${index}`,
    label: `Field ${index}`,
    type: "text",
    control: "input",
    required: false,
  };
}

/**
 * Sortable editor for a custom widget definition's fields. Order in the list is the
 * stored array order (the display/edit order of an instance's fields). Reports every
 * change through `onChange`; the caller validates and persists.
 */
export default function CustomWidgetFieldsBuilder({
  initialFields,
  onSave,
}: CustomWidgetFieldsBuilderProps) {
  const [rows, setRows] = useState<FieldRowState[]>(() =>
    initialFields.map((field) => ({ id: crypto.randomUUID(), field, saved: field })),
  );
  // The last-persisted field list, kept in order so reorders and removals also
  // register as dirty. Reset after a successful save.
  const [baseline, setBaseline] = useState<ReadonlyArray<CustomWidgetField>>(initialFields);
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor));

  const draftFields = rows.map((r) => r.field);
  const dirty = !listEqual(draftFields, baseline);

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const candidates = args.droppableContainers.filter((c) => c.id !== args.active.id);
    const scoped = { ...args, droppableContainers: candidates };
    const hits = pointerWithin(scoped);
    return hits.length > 0 ? hits : closestCenter(scoped);
  }, []);

  function updateField(id: string, patch: Partial<CustomWidgetField>) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, field: { ...r.field, ...patch } } : r)),
    );
  }

  function addField() {
    setRows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), field: makeField(prev.length + 1), saved: null },
    ]);
  }

  function removeField(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    setRows((prev) => {
      const oldIndex = prev.findIndex((r) => r.id === active.id);
      const newIndex = prev.findIndex((r) => r.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  async function handleSave() {
    const draft = rows.map((r) => r.field);
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (!ok) return;
    // The draft is now the persisted state: re-baseline so dirty markers clear.
    setBaseline(draft);
    setRows((prev) => prev.map((r) => ({ ...r, saved: r.field })));
  }

  function discard() {
    setRows(baseline.map((field) => ({ id: crypto.randomUUID(), field, saved: field })));
  }

  return (
    <ClientOnly fallback={null}>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <ol className={s.list}>
            {rows.map((row) => (
              <FieldRow
                key={row.id}
                row={row}
                onChange={(patch) => updateField(row.id, patch)}
                onRemove={() => removeField(row.id)}
              />
            ))}
          </ol>
        </SortableContext>
        {rows.length === 0 && <p className={s.empty}>No fields yet. Add one to get started.</p>}
        <div className={s.toolbar}>
          <Button type="button" intent="primary" variant="outline" size="sm" onClick={addField}>
            Add field
          </Button>
          {dirty && (
            <div className={s.saveActions}>
              <span className={s.dirtyHint}>Unsaved changes</span>
              <Button type="button" variant="outline" size="sm" onClick={discard} disabled={saving}>
                Discard
              </Button>
              <Button
                type="button"
                intent="primary"
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          )}
        </div>
      </DndContext>
    </ClientOnly>
  );
}

function FieldRow({
  row,
  onChange,
  onRemove,
}: {
  row: FieldRowState;
  onChange: (patch: Partial<CustomWidgetField>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };
  const { field } = row;
  const idBase = row.id;
  // Dirty markers: a row added since the last save is "New"; an existing row whose
  // content diverged from its persisted snapshot is "Edited".
  const isNew = row.saved === null;
  const isEdited = row.saved !== null && !fieldsEqual(field, row.saved);
  // Collapse is local view state only (never persisted) so large rows are easier to
  // sort. Defaults to open; collapsing leaves the title visible as a drag handle.
  const [open, setOpen] = useState(true);
  const toggle = () => setOpen((prev) => !prev);
  // Active tab is local view state only (never persisted). Defaults to the basic tab.
  const [tab, setTab] = useState("basic");

  return (
    <li ref={setNodeRef} style={style} className={s.row} {...attributes}>
      <div className={s.rowHeader}>
        <span className={s.dragHandle} {...listeners}>
          <DragIndicatorIcon title="Drag to reorder field" />
        </span>
        <button type="button" className={s.rowTitle} onClick={toggle}>
          {field.label || field.name || "Untitled field"}
        </button>
        {(isNew || isEdited) && <span className={s.dirtyBadge}>{isNew ? "New" : "Edited"}</span>}
        <menu className={s.controls}>
          <button
            type="button"
            className={s.iconButton}
            onClick={toggle}
            aria-expanded={open}
            aria-label={open ? "Collapse field" : "Expand field"}
          >
            <span className={cx(s.collapseIcon, !open && s.collapsed)}>▾</span>
          </button>
          <button
            type="button"
            className={s.iconButton}
            aria-label="Remove field"
            onClick={onRemove}
          >
            <DeleteIcon />
          </button>
        </menu>
      </div>

      <Activity mode={open ? "visible" : "hidden"}>
        <div className={s.rowBody}>
          <Tabs value={tab} onValueChange={(value) => setTab(value as string)}>
            <TabsList variant="line">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="basic">
              <div className={s.fieldGrid}>
                <Field className="½">
                  <FieldLabel htmlFor={`${idBase}-control`}>Control</FieldLabel>
                  <FieldBody>
                    <select
                      id={`${idBase}-control`}
                      className={s.select}
                      value={field.control}
                      onChange={(e) =>
                        onChange({ control: e.target.value as CustomWidgetField["control"] })
                      }
                    >
                      {fieldControls.map((control) => (
                        <option key={control} value={control}>
                          {control}
                        </option>
                      ))}
                    </select>
                  </FieldBody>
                </Field>
                <Field className="¼">
                  <FieldLabel htmlFor={`${idBase}-required`}>Required</FieldLabel>
                  <FieldBody>
                    <label className={s.checkbox}>
                      <input
                        id={`${idBase}-required`}
                        type="checkbox"
                        checked={field.required ?? false}
                        onChange={(e) => onChange({ required: e.target.checked })}
                      />
                      Field is required
                    </label>
                  </FieldBody>
                </Field>

                <Field className="½">
                  <FieldLabel htmlFor={`${idBase}-name`}>Name</FieldLabel>
                  <FieldBody>
                    <Input
                      id={`${idBase}-name`}
                      value={field.name}
                      onChange={(e) => onChange({ name: e.target.value })}
                      placeholder="title"
                    />
                  </FieldBody>
                </Field>
                <Field className="½">
                  <FieldLabel htmlFor={`${idBase}-label`}>Label</FieldLabel>
                  <FieldBody>
                    <Input
                      id={`${idBase}-label`}
                      value={field.label}
                      onChange={(e) => onChange({ label: e.target.value })}
                      placeholder="Title"
                    />
                  </FieldBody>
                </Field>

                <Field className="full">
                  <FieldLabel htmlFor={`${idBase}-description`}>Description</FieldLabel>
                  <FieldBody>
                    <Input
                      id={`${idBase}-description`}
                      value={field.description ?? ""}
                      onChange={(e) => onChange({ description: e.target.value || undefined })}
                      placeholder="Helper text shown under the control"
                    />
                  </FieldBody>
                </Field>
              </div>
            </TabsContent>

            <TabsContent value="advanced">
              <div className={s.fieldGrid}>
                <Field className="¼">
                  <FieldLabel htmlFor={`${idBase}-minlength`}>Min length</FieldLabel>
                  <FieldBody>
                    <Input
                      id={`${idBase}-minlength`}
                      type="number"
                      min={0}
                      value={field.minlength ?? ""}
                      onChange={(e) => onChange({ minlength: numOrUndef(e.target.value) })}
                    />
                  </FieldBody>
                </Field>
                <Field className="¼">
                  <FieldLabel htmlFor={`${idBase}-maxlength`}>Max length</FieldLabel>
                  <FieldBody>
                    <Input
                      id={`${idBase}-maxlength`}
                      type="number"
                      min={1}
                      value={field.maxlength ?? ""}
                      onChange={(e) => onChange({ maxlength: numOrUndef(e.target.value) })}
                    />
                  </FieldBody>
                </Field>

                {field.control === "input" ? (
                  <Field className="½">
                    <FieldLabel htmlFor={`${idBase}-pattern`}>Pattern (regex)</FieldLabel>
                    <FieldBody>
                      <Input
                        id={`${idBase}-pattern`}
                        value={field.pattern ?? ""}
                        onChange={(e) => onChange({ pattern: e.target.value || undefined })}
                        placeholder="^[A-Za-z ]+$"
                      />
                    </FieldBody>
                  </Field>
                ) : (
                  <Field className="¼">
                    <FieldLabel htmlFor={`${idBase}-rows`}>Rows</FieldLabel>
                    <FieldBody>
                      <Input
                        id={`${idBase}-rows`}
                        type="number"
                        min={1}
                        value={field.rows ?? ""}
                        onChange={(e) => onChange({ rows: numOrUndef(e.target.value) })}
                      />
                    </FieldBody>
                  </Field>
                )}

                <Field className="½">
                  <FieldLabel htmlFor={`${idBase}-placeholder`}>Placeholder</FieldLabel>
                  <FieldBody>
                    <Input
                      id={`${idBase}-placeholder`}
                      value={field.placeholder ?? ""}
                      onChange={(e) => onChange({ placeholder: e.target.value || undefined })}
                    />
                  </FieldBody>
                </Field>
                <Field className="½">
                  <FieldLabel htmlFor={`${idBase}-default`}>Default value</FieldLabel>
                  <FieldBody>
                    <Input
                      id={`${idBase}-default`}
                      value={field.defaultValue ?? ""}
                      onChange={(e) => onChange({ defaultValue: e.target.value || undefined })}
                    />
                  </FieldBody>
                </Field>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </Activity>
    </li>
  );
}

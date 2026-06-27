import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldBody, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_LOCALE } from "@/db/schema/pages";
import { type TaxonomyId, type TaxonomyOptionGroup } from "@/db/schema/taxonomy";
import { taxonomyRepo } from "@/repositories/taxonomy";
import { asStr, type FieldControlDescriptor } from "./shared";
import { resolveLabels, selectableLabels, useOptionGroups, useRenderLocale } from "./taxonomyOptions";
import type { FieldControlProps, FieldViewProps, Plugin } from "../types";

// Renders the grouped options: children that have children become `<optgroup>`s (Base UI
// SelectGroup) of their grandchildren; childless children are plain options.
function optionContent(groups: ReadonlyArray<TaxonomyOptionGroup>) {
  return (
    <SelectContent>
      {groups.map((group) =>
        group.children.length > 0 ? (
          <SelectGroup key={group.id}>
            <SelectGroupLabel>{group.label}</SelectGroupLabel>
            {group.children.map((child) => (
              <SelectItem key={child.id} value={child.id}>
                {child.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ) : (
          <SelectItem key={group.id} value={group.id}>
            {group.label}
          </SelectItem>
        ),
      )}
    </SelectContent>
  );
}

// Edit control: a select sourced from a taxonomy parent's children. Children that themselves have
// children become `<optgroup>`s of their grandchildren. Stores the selected taxonomy id(s) (stable
// across renames/translations); labels resolve per locale at render. When the field is repeatable
// ("Allow multiple"), this renders a native multi-select storing an array of ids — the descriptor's
// `selfRepeats` opts it out of the framework's Add/Remove wrapper.
export function SelectControl({ id, field, value, onChange }: FieldControlProps) {
  const locale = useRenderLocale();
  const parentId = (field.taxonomyId ?? null) as TaxonomyId | null;
  const { data: groups = [], isLoading } = useOptionGroups(parentId, locale);
  const labels = useMemo(() => selectableLabels(groups), [groups]);

  if (parentId === null) {
    return (
      <p style={{ color: "var(--text-muted)" }}>
        No option source configured — pick a taxonomy in this field’s advanced settings.
      </p>
    );
  }

  // Multi-select: value is an array of ids; the popup stays open for multiple picks.
  if (field.repeatable) {
    const selected = Array.isArray(value)
      ? (value.filter((v) => typeof v === "string") as string[])
      : value
        ? [String(value)]
        : [];
    return (
      <Select
        multiple
        items={labels}
        value={selected}
        onValueChange={(next) => onChange(next as string[])}
        disabled={isLoading}
      >
        <SelectTrigger id={id} aria-required={field.required}>
          <SelectValue placeholder={isLoading ? "Loading…" : "Select options"}>
            {(vals) => {
              const arr = (vals as string[] | null) ?? [];
              return arr.length ? arr.map((v) => labels[v] ?? v).join(", ") : "Select options";
            }}
          </SelectValue>
        </SelectTrigger>
        {optionContent(groups)}
      </Select>
    );
  }

  // Single-select: value is one id (or empty).
  const selected = asStr(value);
  return (
    <Select
      items={labels}
      value={selected || null}
      onValueChange={(next) => onChange((next as string | null) ?? "")}
      disabled={isLoading}
    >
      <SelectTrigger id={id} aria-required={field.required}>
        <SelectValue placeholder={isLoading ? "Loading…" : "Select an option"}>
          {(val) => (val ? (labels[val as string] ?? (val as string)) : "Select an option")}
        </SelectValue>
      </SelectTrigger>
      {optionContent(groups)}
    </Select>
  );
}

// View component: resolve the stored id(s) to their per-locale labels. Renders nothing when the
// value is empty or can't be resolved (e.g. the option was deleted), so an empty field drops out
// of the generic view.
export function SelectView({ field, value }: FieldViewProps) {
  const locale = useRenderLocale();
  const parentId = (field.taxonomyId ?? null) as TaxonomyId | null;
  const { data: groups = [] } = useOptionGroups(parentId, locale);
  const labels = useMemo(() => selectableLabels(groups), [groups]);

  const resolved = resolveLabels(value, labels);
  if (resolved.length === 0) return null;
  return <>{resolved.join(", ")}</>;
}

export const selectDescriptor: FieldControlDescriptor = {
  control: "select",
  label: "Select",
  // "Allow multiple" renders a native multi-select (one box, many picks), not the generic
  // Add/Remove repeated dropdowns.
  selfRepeats: true,
  advancedFields: [
    {
      key: "taxonomyId",
      label: "Option source (taxonomy)",
      // Bespoke builder input — a live taxonomy picker, not a static select. Handled by a
      // dedicated branch in CustomWidgetFieldsBuilder that renders <TaxonomyParentPicker>.
      inputType: "taxonomyParent",
      width: "full",
    },
  ],
  // No `format`: the React `SelectView` handles display (it needs to fetch a localized label for
  // the stored id, which the React-free `format` hook can't do).
};

export const selectPlugin: Plugin = {
  name: "select",
  setup(api) {
    api.registerFieldControl("select", SelectControl);
    api.registerFieldView("select", SelectView);
  },
};

// ── Builder input ──────────────────────────────────────────────────────────
// Rendered by the builder's `taxonomyParent` branch (not a generic input). Lets an admin pick an
// existing root taxonomy as the option source, or create a new one inline. Writes the chosen
// taxonomy id to the field's `taxonomyId`.
export function TaxonomyParentPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (taxonomyId: string | undefined) => void;
}) {
  const qc = useQueryClient();
  const { data: roots = [] } = useQuery(taxonomyRepo.byParent(null));
  const createMutation = useMutation(taxonomyRepo.create(qc));
  const [creating, setCreating] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const rootLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const root of roots) map[root.id] = root.locales?.[DEFAULT_LOCALE] ?? root.value;
    return map;
  }, [roots]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const value = newValue.trim();
    if (!value) return;
    const label = newLabel.trim() || value;
    try {
      const created = await createMutation.mutateAsync({
        value,
        parentId: null,
        locales: { [DEFAULT_LOCALE]: label },
      });
      onChange(created.id);
      setNewValue("");
      setNewLabel("");
      setCreating(false);
      toast.success(`Created taxonomy “${label}”`);
    } catch (err) {
      toast.error("Couldn’t create taxonomy", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  }

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <Select
        items={rootLabels}
        value={value || null}
        onValueChange={(next) => onChange((next as string | null) ?? undefined)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Choose a taxonomy">
            {(val) => (val ? (rootLabels[val as string] ?? (val as string)) : "Choose a taxonomy")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {roots.map((root) => (
            <SelectItem key={root.id} value={root.id}>
              {root.locales?.[DEFAULT_LOCALE] ?? root.value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {creating ? (
        <form onSubmit={handleCreate} style={{ display: "grid", gap: "0.5rem" }}>
          <Field>
            <FieldLabel htmlFor="new-taxonomy-value">Value (canonical)</FieldLabel>
            <FieldBody>
              <Input
                id="new-taxonomy-value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="colors"
              />
            </FieldBody>
          </Field>
          <Field>
            <FieldLabel htmlFor="new-taxonomy-label">Label ({DEFAULT_LOCALE})</FieldLabel>
            <FieldBody>
              <Input
                id="new-taxonomy-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Colors"
              />
            </FieldBody>
          </Field>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button
              type="submit"
              size="sm"
              intent="primary"
              disabled={!newValue.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Create"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setCreating(true)}>
          ＋ New taxonomy
        </Button>
      )}
    </div>
  );
}

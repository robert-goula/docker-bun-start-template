import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
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
import { resolveLocale } from "@/lib/locale";
import { taxonomyRepo } from "@/repositories/taxonomy";
import { asStr, type FieldControlDescriptor } from "./shared";
import type { FieldControlProps, FieldViewProps, Plugin } from "../types";

// A node with children renders as an `<optgroup>` heading (not itself selectable); a childless
// node is a plain option. Flatten the grouped tree to the set of SELECTABLE id → label pairs:
// childless children at the top level plus every grandchild.
function selectableLabels(groups: ReadonlyArray<TaxonomyOptionGroup>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const group of groups) {
    if (group.children.length > 0) {
      for (const child of group.children) map[child.id] = child.label;
    } else {
      map[group.id] = group.label;
    }
  }
  return map;
}

// The render locale comes from the URL (default locale is unprefixed) — same rule the rest of
// the public render path uses (see Menu.tsx).
function useRenderLocale() {
  const { pathname } = useLocation();
  return resolveLocale(pathname).locale ?? DEFAULT_LOCALE;
}

// Edit control: a single-select sourced from a taxonomy parent's children. Children that
// themselves have children become `<optgroup>`s (Base UI SelectGroup) of their grandchildren.
// Stores the selected taxonomy id (stable across renames/translations); the label is resolved per
// locale at render. Repetition is handled by the framework's RepeatableField wrapper.
export function SelectControl({ id, field, value, onChange }: FieldControlProps) {
  const locale = useRenderLocale();
  const parentId = (field.taxonomyId ?? null) as TaxonomyId | null;
  const { data: groups = [], isLoading } = useQuery({
    ...taxonomyRepo.optionGroups(parentId, locale),
    enabled: parentId !== null,
  });
  const labels = useMemo(() => selectableLabels(groups), [groups]);
  const selected = asStr(value);

  if (parentId === null) {
    return (
      <p style={{ color: "var(--text-muted)" }}>
        No option source configured — pick a taxonomy in this field’s advanced settings.
      </p>
    );
  }

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
    </Select>
  );
}

// View component: resolve the stored id(s) to their per-locale labels. Renders nothing when the
// value is empty or can't be resolved (e.g. the option was deleted), so an empty field drops out
// of the generic view.
export function SelectView({ field, value }: FieldViewProps) {
  const locale = useRenderLocale();
  const parentId = (field.taxonomyId ?? null) as TaxonomyId | null;
  const { data: groups = [] } = useQuery({
    ...taxonomyRepo.optionGroups(parentId, locale),
    enabled: parentId !== null,
  });
  const labels = useMemo(() => selectableLabels(groups), [groups]);

  const ids = Array.isArray(value) ? value : value ? [value] : [];
  const resolved = ids.map((v) => labels[String(v)]).filter((label): label is string => !!label);
  if (resolved.length === 0) return null;
  return <>{resolved.join(", ")}</>;
}

export const selectDescriptor: FieldControlDescriptor = {
  control: "select",
  label: "Select",
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

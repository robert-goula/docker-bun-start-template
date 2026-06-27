import { useMemo } from "react";
import { CheckboxGroup, CheckboxGroupItem } from "@/components/ui/checkbox";
import { type TaxonomyId, type TaxonomyOptionGroup } from "@/db/schema/taxonomy";
import { type FieldControlDescriptor } from "./shared";
import {
  resolveLabels,
  selectableLabels,
  useOptionGroups,
  useRenderLocale,
} from "./taxonomyOptions";
import type { FieldControlProps, FieldViewProps, Plugin } from "../types";

// Renders the grouped options as checkbox rows: a child that itself has children becomes a heading of
// its grandchildren; a childless child is a plain checkbox. Mirrors the select control's `optionContent`.
function checkboxItems(groups: ReadonlyArray<TaxonomyOptionGroup>) {
  return groups.map((group) =>
    group.children.length > 0 ? (
      <div key={group.id} style={{ display: "grid", gap: "0.25rem" }}>
        <span style={{ fontSize: "var(--fontSize-xs)", color: "var(--text-muted)" }}>
          {group.label}
        </span>
        {group.children.map((child) => (
          <CheckboxGroupItem key={child.id} name={child.id}>
            {child.label}
          </CheckboxGroupItem>
        ))}
      </div>
    ) : (
      <CheckboxGroupItem key={group.id} name={group.id}>
        {group.label}
      </CheckboxGroupItem>
    ),
  );
}

// Edit control: a checkbox group sourced from a taxonomy parent's children. Multi-select — stores an
// array of selected taxonomy ids. The descriptor's `selfRepeats` opts it out of the framework's
// Add/Remove wrapper, so it owns the array shape directly (see SelectControl's repeatable branch).
export function CheckboxControl({ id, field, value, onChange }: FieldControlProps) {
  const locale = useRenderLocale();
  const parentId = (field.taxonomyId ?? null) as TaxonomyId | null;
  const { data: groups = [], isLoading } = useOptionGroups(parentId, locale);

  if (parentId === null) {
    return (
      <p style={{ color: "var(--text-muted)" }}>
        No option source configured — pick a taxonomy in this field’s advanced settings.
      </p>
    );
  }

  if (isLoading) return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;

  const selected = Array.isArray(value)
    ? (value.filter((v) => typeof v === "string") as string[])
    : value
      ? [String(value)]
      : [];
  return (
    <CheckboxGroup
      id={id}
      aria-required={field.required}
      value={selected}
      onValueChange={(next) => onChange(next)}
    >
      {checkboxItems(groups)}
    </CheckboxGroup>
  );
}

// View component: resolve the stored ids to their per-locale labels, joined with ", ". Renders
// nothing when empty or unresolvable, so an empty field drops out of the generic view.
export function CheckboxView({ field, value }: FieldViewProps) {
  const locale = useRenderLocale();
  const parentId = (field.taxonomyId ?? null) as TaxonomyId | null;
  const { data: groups = [] } = useOptionGroups(parentId, locale);
  const labels = useMemo(() => selectableLabels(groups), [groups]);

  const resolved = resolveLabels(value, labels);
  if (resolved.length === 0) return null;
  return <>{resolved.join(", ")}</>;
}

export const checkboxDescriptor: FieldControlDescriptor = {
  control: "checkbox",
  label: "Checkbox",
  // Multi-select is the natural checkbox UX (one group, many ticks), not the generic Add/Remove
  // repeated controls — so it self-handles "Allow multiple".
  selfRepeats: true,
  advancedFields: [
    {
      key: "taxonomyId",
      label: "Option source (taxonomy)",
      // Bespoke builder input — the same live taxonomy picker the select control uses.
      inputType: "taxonomyParent",
      width: "full",
    },
  ],
  // No `format`: the React `CheckboxView` handles display (it fetches localized labels for the stored
  // ids, which the React-free `format` hook can't do).
};

export const checkboxPlugin: Plugin = {
  name: "checkbox",
  setup(api) {
    api.registerFieldControl("checkbox", CheckboxControl);
    api.registerFieldView("checkbox", CheckboxView);
  },
};

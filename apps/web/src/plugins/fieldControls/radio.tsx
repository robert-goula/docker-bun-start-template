import { useMemo } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { type TaxonomyId, type TaxonomyOptionGroup } from "@/db/schema/taxonomy";
import { asStr, type FieldControlDescriptor } from "./shared";
import {
  resolveLabels,
  selectableLabels,
  useOptionGroups,
  useRenderLocale,
} from "./taxonomyOptions";
import type { FieldControlProps, FieldViewProps, Plugin } from "../types";

// Renders the grouped options as radio rows: a child that itself has children becomes a heading of
// its grandchildren; a childless child is a plain radio. Mirrors the select control's `optionContent`.
function radioItems(groups: ReadonlyArray<TaxonomyOptionGroup>) {
  return groups.map((group) =>
    group.children.length > 0 ? (
      <div key={group.id} style={{ display: "grid", gap: "0.25rem" }}>
        <span style={{ fontSize: "var(--fontSize-xs)", color: "var(--text-muted)" }}>
          {group.label}
        </span>
        {group.children.map((child) => (
          <RadioGroupItem key={child.id} value={child.id}>
            {child.label}
          </RadioGroupItem>
        ))}
      </div>
    ) : (
      <RadioGroupItem key={group.id} value={group.id}>
        {group.label}
      </RadioGroupItem>
    ),
  );
}

// Edit control: a radio group sourced from a taxonomy parent's children. Stores the selected taxonomy
// id (stable across renames/translations); labels resolve per locale at render. Single-select — radio
// is inherently one-of, so this control is not `selfRepeats`.
export function RadioControl({ id, field, value, onChange }: FieldControlProps) {
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

  const selected = asStr(value);
  return (
    <RadioGroup
      id={id}
      aria-required={field.required}
      value={selected || null}
      onValueChange={(next) => onChange((next as string | null) ?? "")}
    >
      {radioItems(groups)}
    </RadioGroup>
  );
}

// View component: resolve the stored id to its per-locale label. Renders nothing when empty or
// unresolvable (e.g. the option was deleted), so an empty field drops out of the generic view.
export function RadioView({ field, value }: FieldViewProps) {
  const locale = useRenderLocale();
  const parentId = (field.taxonomyId ?? null) as TaxonomyId | null;
  const { data: groups = [] } = useOptionGroups(parentId, locale);
  const labels = useMemo(() => selectableLabels(groups), [groups]);

  const resolved = resolveLabels(value, labels);
  if (resolved.length === 0) return null;
  return <>{resolved.join(", ")}</>;
}

export const radioDescriptor: FieldControlDescriptor = {
  control: "radio",
  label: "Radio",
  advancedFields: [
    {
      key: "taxonomyId",
      label: "Option source (taxonomy)",
      // Bespoke builder input — a live taxonomy picker. Handled by the same `taxonomyParent` branch
      // in CustomWidgetFieldsBuilder the select control uses.
      inputType: "taxonomyParent",
      width: "full",
    },
  ],
  // No `format`: the React `RadioView` handles display (it fetches a localized label for the stored
  // id, which the React-free `format` hook can't do).
};

export const radioPlugin: Plugin = {
  name: "radio",
  setup(api) {
    api.registerFieldControl("radio", RadioControl);
    api.registerFieldView("radio", RadioView);
  },
};

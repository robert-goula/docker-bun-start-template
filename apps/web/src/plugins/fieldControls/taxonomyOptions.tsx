// Shared helpers for taxonomy-backed controls (select / radio / checkbox). Each of these controls
// sources its choices from a taxonomy parent and resolves localized labels at render — this module
// is the single source of truth for that logic so the controls stay thin.

import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { DEFAULT_LOCALE, type Locale } from "@/db/schema/pages";
import { type TaxonomyId, type TaxonomyOptionGroup } from "@/db/schema/taxonomy";
import { resolveLocale } from "@/lib/locale";
import { taxonomyRepo } from "@/repositories/taxonomy";
import type { Json } from "@/types/Json";

// A node with children renders as an `<optgroup>`-style heading (not itself selectable); a childless
// node is a plain option. Flatten the grouped tree to the set of SELECTABLE id → label pairs:
// childless children at the top level plus every grandchild.
export function selectableLabels(groups: ReadonlyArray<TaxonomyOptionGroup>): Record<string, string> {
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
export function useRenderLocale(): Locale {
  const { pathname } = useLocation();
  return resolveLocale(pathname).locale ?? DEFAULT_LOCALE;
}

// Fetches the grouped child options of a taxonomy parent. Disabled (and returns no data) until a
// parent is configured, mirroring the query both the control and its view run.
export function useOptionGroups(parentId: TaxonomyId | null, locale: Locale) {
  return useQuery({
    ...taxonomyRepo.optionGroups(parentId, locale),
    enabled: parentId !== null,
  });
}

// Resolve a stored value (one id or an array of ids) to the labels that still exist in `labels`
// (an option deleted from the taxonomy resolves to nothing and drops out).
export function resolveLabels(value: Json, labels: Record<string, string>): string[] {
  const ids = Array.isArray(value) ? value : value ? [value] : [];
  return ids.map((v) => labels[String(v)]).filter((label): label is string => !!label);
}

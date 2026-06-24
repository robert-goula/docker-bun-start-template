import type { MenuItem, MenuLink } from "@/db/schema/menus";
import { buildHref, type Locale } from "@/lib/locale";

// A page resolved for one locale: the locale's own slug + title for a translation group.
export interface ResolvedPage {
  slug: string;
  title: string;
}

// A page row from the (requested-or-default locale) query feeding the resolver. `locale` is
// the raw column value (string), compared against the requested locale to pick the row.
export interface PageGroupRow {
  groupId: string;
  slug: string;
  title: string;
  locale: string;
}

/**
 * Indexes page rows by their translation group, choosing each group's row for `locale` when
 * present and otherwise keeping the default-locale row already seen. The query is expected to
 * return only the requested + default locales, so this resolves the "use the locale's slug/
 * title, fall back to the default translation" rule the menu resolver relies on.
 */
export function indexPagesByGroup(
  rows: ReadonlyArray<PageGroupRow>,
  locale: Locale,
): Map<string, ResolvedPage> {
  const byGroup = new Map<string, ResolvedPage>();
  for (const row of rows) {
    const existing = byGroup.get(row.groupId);
    if (!existing || row.locale === locale) {
      byGroup.set(row.groupId, { slug: row.slug, title: row.title });
    }
  }
  return byGroup;
}

/**
 * Pure resolution of a menu item tree into locale-baked links (the render projection). Kept
 * free of the database so it's unit-testable: the caller supplies `pageFor`, which returns
 * the already-locale-selected page for a `page` item's groupId (or undefined if it no longer
 * exists). Page items become `{ href, label }` (the locale's slug via buildHref + its title,
 * an explicit `label` override winning); external items keep href/label/newTab; heading items
 * have no href. A page whose group resolves to nothing is dropped so one stale reference can't
 * break the menu.
 */
export function resolveMenuItems(
  items: ReadonlyArray<MenuItem>,
  locale: Locale,
  pageFor: (groupId: string) => ResolvedPage | undefined,
): MenuLink[] {
  const out: MenuLink[] = [];
  for (const item of items) {
    const children = resolveMenuItems(item.children, locale, pageFor);
    if (item.type === "page") {
      const page = pageFor(item.groupId);
      if (!page) continue;
      out.push({
        id: item.id,
        label: item.label ?? page.title,
        href: buildHref(locale, page.slug),
        children,
      });
    } else if (item.type === "external") {
      out.push({ id: item.id, label: item.label, href: item.href, newTab: item.newTab, children });
    } else {
      out.push({ id: item.id, label: item.label, children });
    }
  }
  return out;
}

import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useIntlayer } from "react-intlayer";
import { resolveLocale } from "@/lib/locale";
import s from "./Debug.module.css";

/**
 * The "debug" widget kind: a developer panel that only appears while the page is
 * in edit mode (the page view filters it out entirely — see EDIT_ONLY_WIDGET_KINDS).
 * It has no editable content (size is adjustable via the widget settings like any
 * other widget). It surfaces the resolved locale (from the pathname, the same authority
 * the root resolver uses) and how TanStack Router sees the current route — both the
 * templated route (with param placeholders) and the resolved path.
 */
interface LeafMatch {
  routeId: string;
  fullPath: string;
  params: Record<string, unknown>;
}

export default function Debug() {
  const content = useIntlayer("debug");
  const { routeId, template, params, pathname } = useRouterState({
    select: (state) => {
      const matches = state.matches as ReadonlyArray<LeafMatch>;
      const leaf = matches[matches.length - 1];
      return {
        routeId: leaf?.routeId ?? "",
        template: leaf?.fullPath ?? leaf?.routeId ?? "",
        params: leaf?.params ?? {},
        pathname: state.location.pathname,
      };
    },
  });

  // The resolver (src/lib/locale.ts) is the source of truth for locale, not the
  // structural `{-$locale}` route param — so resolve from the pathname directly.
  const resolved = resolveLocale(pathname);
  const locale = resolved.redirect !== undefined ? content.redirecting : resolved.locale;

  const rows: Array<{ key: string; label: ReactNode; value: ReactNode }> = [
    { key: "locale", label: content.locale, value: locale },
    { key: "routeId", label: content.routeId, value: routeId },
    { key: "template", label: content.routeWithParams, value: template },
    { key: "params", label: content.params, value: JSON.stringify(params) },
    { key: "pathname", label: content.resolvedSlug, value: pathname },
  ];

  return (
    <dl className={s.debug}>
      {rows.map(({ key, label, value }) => (
        <div key={key} className={s.row}>
          <dt className={s.label}>{label}</dt>
          <dd className={s.value}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

import { useRouterState } from "@tanstack/react-router";
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
  const locale = resolved.redirect !== undefined ? "(redirecting…)" : resolved.locale;

  const rows: Array<[string, string]> = [
    ["Locale", locale],
    ["Route ID", routeId],
    ["Route (with params)", template],
    ["Params", JSON.stringify(params)],
    ["Resolved slug", pathname],
  ];

  return (
    <dl className={s.debug}>
      {rows.map(([label, value]) => (
        <div key={label} className={s.row}>
          <dt className={s.label}>{label}</dt>
          <dd className={s.value}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

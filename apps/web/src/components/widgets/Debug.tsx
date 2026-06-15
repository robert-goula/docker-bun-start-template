import { useRouterState } from "@tanstack/react-router";
import s from "./Debug.module.css";

/**
 * The "debug" widget kind: a developer panel that only appears while the page is
 * in edit mode (the page view filters it out entirely — see EDIT_ONLY_WIDGET_KINDS).
 * It has no editable content (size is adjustable via the widget settings like any
 * other widget). For now it surfaces the current locale and how TanStack Router
 * sees the current route — both the templated route (with param placeholders) and
 * the resolved path.
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

  // Resolves automatically once a `{$locale}` route param exists; until then the
  // default locale is shown (locale routing is not implemented yet).
  const localeParam = (params as Record<string, unknown>).locale;
  const locale = typeof localeParam === "string" ? localeParam : "en-us (default · routing TBD)";

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

import { queryOptions } from "@tanstack/react-query";
import type { LayoutId } from "@/db/schema/layouts";
import type { Locale } from "@/db/schema/pages";
import { loadLayoutWidgetsFn, saveLayoutWidgetsFn } from "@/server/fns/layouts";
import type { PageLayout } from "@/components/Zone";

// A layout-default widget scope is a (layout, locale) pair; a null locale is the
// all-locales defaults. The query key folds null to "all" so it stays a stable string.
export const layoutWidgetsKeys = {
  all: ["layoutWidgets"] as const,
  scope: (layoutId: LayoutId, locale: Locale | null) =>
    [...layoutWidgetsKeys.all, layoutId, locale ?? "all"] as const,
};

export const layoutWidgetsRepo = {
  // The layout's zone arrangement filled with its default widgets for one scope, shaped
  // as a PageLayout so the admin editor can drive it with the same PageBuilder as pages.
  forScope: (layoutId: LayoutId, locale: Locale | null) =>
    queryOptions({
      queryKey: layoutWidgetsKeys.scope(layoutId, locale),
      queryFn: ({ signal }) => loadLayoutWidgetsFn({ data: { layoutId, locale }, signal }),
      // PageBuilder seeds its own state once; never refetch out from under an open edit.
      staleTime: Infinity,
    }),
};

export function saveLayoutWidgets(layoutId: LayoutId, locale: Locale | null, layout: PageLayout) {
  return saveLayoutWidgetsFn({ data: { layoutId, locale, layout } });
}

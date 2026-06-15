import type { QueryClient } from "@tanstack/react-query";
import { LOCALES, type Locale } from "@/db/schema/pages";
import { markdownQueryOptions } from "@/server/fns/markdown";
import { loadPageLayoutFn, savePageLayoutFn, setPageLayoutFn } from "@/server/fns/pages";
import type { PageLayout } from "@/routes/_authed/style-guide/types";

/**
 * Splits a resolved route pathname into a page slug and optional locale. A leading
 * locale segment (e.g. "/es-us/about") is peeled off into `locale`, leaving the
 * locale-agnostic slug ("/about"). Paths without a known locale prefix pass through
 * unchanged ("/about" -> { slug: "/about" }); the index ("/") stays "/".
 */
function parsePathname(pathname: string): { slug: string; locale?: Locale } {
  const [first, ...rest] = pathname.split("/").filter(Boolean);
  if (first && (LOCALES as readonly string[]).includes(first)) {
    return { slug: `/${rest.join("/")}`, locale: first as Locale };
  }
  return { slug: pathname };
}

/**
 * Loads a page's layout for a resolved route pathname and warms the query cache
 * for its markdown widgets so they render server-side (dehydrated via the SSR
 * query integration). The page title lives in the DB (derived from the slug on
 * first creation) — callers only supply the pathname.
 */
export async function loadPage(queryClient: QueryClient, pathname: string) {
  const layout = await loadPageLayoutFn({ data: parsePathname(pathname) });
  await Promise.all(
    layout.zones.flatMap((zone) =>
      zone.widgets
        .filter((w) => w.kind === "markdown" && typeof w.options.content === "string")
        .map((w) => queryClient.prefetchQuery(markdownQueryOptions(w.options.content as string))),
    ),
  );
  return layout;
}

/**
 * Persists a page's widget content for a resolved route pathname. Zone arrangement
 * is owned by the page's layout and is not written here. Mirrors `loadPage`'s
 * pathname → { slug, locale } resolution so saves target the same page.
 */
export function savePage(pathname: string, layout: PageLayout) {
  return savePageLayoutFn({ data: { ref: parsePathname(pathname), layout } });
}

/**
 * Re-points the page at a resolved route pathname to a different layout. Only the
 * layout link changes; the page's widget content is preserved. Callers reload the
 * route afterwards to render the new zone arrangement.
 */
export function setPageLayout(pathname: string, layoutId: string) {
  return setPageLayoutFn({ data: { ref: parsePathname(pathname), layoutId } });
}

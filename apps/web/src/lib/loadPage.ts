import { notFound } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { CustomWidgetId } from "@/db/schema/customWidgets";
import type { Locale } from "@/db/schema/pages";
import { buildHref, resolveLocale } from "@/lib/locale";
import { markdownQueryOptions } from "@/server/fns/markdown";
import {
  loadPageLayoutFn,
  resolvePageMetaFn,
  savePageLayoutFn,
  setPageLayoutFn,
} from "@/server/fns/pages";
import { customWidgetsRepo } from "@/repositories/customWidgets";
import type { PageLayout } from "@/components/Zone";
import type { PageMeta } from "@/server/services/PageRepo";

export interface PageRef {
  slug: string;
  locale: Locale;
}

/**
 * Resolves a route pathname to a { slug, locale } page ref using the same authority as
 * the root resolver (src/lib/locale.ts). Editing actions in PageBuilder only have the
 * pathname to hand; the page they target was already canonicalized by the root redirect,
 * so a redundant default-locale prefix never reaches here.
 */
function refFromPathname(pathname: string): PageRef {
  const resolved = resolveLocale(pathname);
  return resolved.redirect !== undefined
    ? { slug: pathname, locale: "en-us" }
    : { slug: resolved.path, locale: resolved.locale };
}

/**
 * Loads a page's layout for a resolved { slug, locale } ref and warms the query cache for
 * its widgets so they render server-side (dehydrated via the SSR query integration):
 * markdown is pre-rendered to HTML, and each dynamic widget's public definition projection
 * is prefetched so its bound custom component server-renders too. The page title lives in
 * the DB (derived from the slug on first creation). Locale is resolved before render by the
 * root resolver and passed in via router context — never re-derived from a module global.
 */
export async function loadPage(queryClient: QueryClient, ref: PageRef) {
  const layout = await loadPageLayoutFn({ data: ref });
  await Promise.all(
    layout.zones.flatMap((zone) =>
      zone.widgets.flatMap((w) => {
        if (w.kind === "markdown" && typeof w.content === "string") {
          return [queryClient.prefetchQuery(markdownQueryOptions(w.content))];
        }
        if (w.kind === "dynamic") {
          const definitionId = (w.options as { definitionId?: unknown } | undefined)?.definitionId;
          if (typeof definitionId === "string") {
            return [
              queryClient.prefetchQuery(
                customWidgetsRepo.forRender(definitionId as CustomWidgetId),
              ),
            ];
          }
        }
        return [];
      }),
    ),
  );
  return layout;
}

/**
 * Loader for the public CMS route. Resolution is read-only first: an unknown slug 404s
 * (notFound) rather than auto-creating. The home page ("/") is the one auto-create
 * fallback — it's always renderable, seeded on first visit. On success, widgets are
 * warmed for SSR and metadata is returned for the page `head` + hreflang alternates.
 */
export async function loadCmsPage(queryClient: QueryClient, ref: PageRef) {
  const isHome = ref.slug === "/";
  let meta = await resolvePageMetaFn({ data: ref });
  if (meta === null && !isHome) throw notFound();

  const layout = await loadPage(queryClient, ref);
  // Home's first-ever visit just created the row above; re-read so the title is real.
  if (meta === null) meta = await resolvePageMetaFn({ data: ref });

  return { layout, meta, ref };
}

/**
 * Builds TanStack Start `head` content from resolved page metadata: title/description for
 * SEO, a canonical link, and one `hreflang` alternate per locale the slug exists in — all
 * URLs built through buildHref so the prefix rule lives in exactly one place.
 */
export function buildPageHead(ref: PageRef, meta: PageMeta | null) {
  const title = meta?.meta.title ?? "Page";
  const description = meta?.meta.description ?? null;
  const slug = meta?.canonicalSlug ?? ref.slug;
  const locales = meta?.availableLocales ?? [ref.locale];
  return {
    meta: [{ title }, ...(description ? [{ name: "description", content: description }] : [])],
    links: [
      { rel: "canonical", href: buildHref(ref.locale, slug) },
      ...locales.map((l) => ({ rel: "alternate", hrefLang: l, href: buildHref(l, slug) })),
    ],
  };
}

/**
 * Persists a page's widget content for a resolved route pathname. Zone arrangement
 * is owned by the page's layout and is not written here. Mirrors `loadPage`'s
 * pathname → { slug, locale } resolution so saves target the same page.
 */
export function savePage(pathname: string, layout: PageLayout) {
  return savePageLayoutFn({ data: { ref: refFromPathname(pathname), layout } });
}

/**
 * Re-points the page at a resolved route pathname to a different layout. Only the
 * layout link changes; the page's widget content is preserved. Callers reload the
 * route afterwards to render the new zone arrangement.
 */
export function setPageLayout(pathname: string, layoutId: string) {
  return setPageLayoutFn({ data: { ref: refFromPathname(pathname), layoutId } });
}

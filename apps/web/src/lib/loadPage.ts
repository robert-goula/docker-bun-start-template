import { notFound } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { CustomWidgetId } from "@/db/schema/customWidgets";
import type { Locale } from "@/db/schema/pages";
import { buildHref, resolveLocale } from "@/lib/locale";
import { headTagsForPage } from "@/lib/meta/registry";
import type { PageMetaData } from "@/lib/meta/types";
import { markdownQueryOptions } from "@/server/fns/markdown";
import {
  loadPageLayoutFn,
  resolvePageMetaFn,
  savePageLayoutFn,
  setPageLayoutFn,
  updatePageMetaFn,
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
 * Builds TanStack Start `head` content from resolved page metadata. Tag emission is
 * registry-driven: every metadata module contributes its tags (basic → title +
 * description, Open Graph → og:*, …) via headTagsForPage. Canonical + per-locale hreflang
 * alternates are added here since they need buildHref + the slug's sibling locales — all
 * URLs built through buildHref so the prefix rule lives in exactly one place.
 */
export function buildPageHead(ref: PageRef, meta: PageMeta | null) {
  const slug = meta?.canonicalSlug ?? ref.slug;
  // Slugs are per-locale, so each alternate uses its own translation's slug (not this
  // page's). Falls back to the current page when metadata is unavailable.
  const translations = meta?.translations ?? [{ locale: ref.locale, slug }];
  const fromModules = meta
    ? headTagsForPage(meta.modules, { ref, slug, locale: ref.locale })
    : { meta: [{ title: "Page" }], links: [] as Record<string, string>[] };
  return {
    meta: fromModules.meta,
    links: [
      ...fromModules.links,
      { rel: "canonical", href: buildHref(ref.locale, slug) },
      ...translations.map((t) => ({
        rel: "alternate",
        hrefLang: t.locale,
        href: buildHref(t.locale, t.slug),
      })),
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

/**
 * Persists a page's metadata for a resolved route pathname: the basic fields
 * (title/description) and any extension modules (Open Graph, …). Mirrors `savePage`'s
 * pathname → { slug, locale } resolution so edits target the locale being viewed.
 */
export function savePageMeta(
  pathname: string,
  patch: { slug?: string; title?: string; description?: string | null; modules?: PageMetaData },
) {
  return updatePageMetaFn({ data: { ref: refFromPathname(pathname), ...patch } });
}

import type { ReactNode } from "react";
import { useLocation, useRouter } from "@tanstack/react-router";
import PageBuilder from "@/components/PageBuilder";
import PageMetaPanel from "@/components/meta/PageMetaPanel";
import { savePage, savePageMeta, setPageLayout } from "@/lib/loadPage";
import { buildHref, normalizeSlug } from "@/lib/locale";
import type { PageLayout } from "@/components/Zone";
import type { PageRef } from "@/lib/loadPage";
import type { PageMeta } from "@/server/services/PageRepo";

/**
 * Renders a CMS page's widgets and wires the authoring actions. Used by both the home
 * index and the dynamic slug route — locale + slug come from the loader (router context),
 * so this component just needs the resolved ref, layout, metadata, and the current pathname
 * for saves. The metadata editor surfaces in edit mode via PageBuilder's toolbar slot.
 *
 * `children`, when provided, render between the hero and main zones (see PageBuilder). This
 * lets callers (e.g. admin screens) embed their own content inside the page-builder chrome.
 */
export default function CmsPage({
  ref,
  page,
  meta,
  children,
}: {
  ref: PageRef;
  page: PageLayout & { layoutId: string };
  meta: PageMeta | null;
  children?: ReactNode;
}) {
  const pathname = useLocation({ select: (l) => l.pathname });
  const router = useRouter();
  return (
    <PageBuilder
      key={page.layoutId}
      initialLayout={page}
      layoutId={page.layoutId}
      zonesLocked
      betweenHeroAndMain={children}
      toolbar={
        <PageMetaPanel
          meta={meta}
          onSave={(patch) => {
            // Renaming the slug changes the page's URL: navigate to it after the write so
            // the address bar + edit session stay valid (a full nav keeps SSR head correct).
            const renamedHref =
              patch.slug !== undefined && normalizeSlug(patch.slug) !== (meta?.canonicalSlug ?? "")
                ? buildHref(ref.locale, normalizeSlug(patch.slug))
                : null;
            savePageMeta(pathname, patch)
              .then(() => {
                if (renamedHref && renamedHref !== pathname) {
                  globalThis.location.assign(renamedHref);
                } else {
                  router.invalidate();
                }
              })
              .catch(console.error);
          }}
        />
      }
      onSave={(next) => {
        savePage(pathname, next).catch(console.error);
      }}
      onLayoutChange={(layoutId) => {
        setPageLayout(pathname, layoutId)
          .then(() => router.invalidate())
          .catch(console.error);
      }}
    />
  );
}

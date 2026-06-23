import { useLocation, useRouter } from "@tanstack/react-router";
import PageBuilder from "@/components/PageBuilder";
import PageMetaPanel from "@/components/meta/PageMetaPanel";
import { savePage, savePageMeta, setPageLayout } from "@/lib/loadPage";
import type { PageLayout } from "@/components/Zone";
import type { PageMeta } from "@/server/services/PageRepo";

/**
 * Renders a CMS page's widgets and wires the authoring actions. Used by both the home
 * index and the dynamic slug route — locale + slug come from the loader (router context),
 * so this component just needs the resolved layout, metadata, and the current pathname for
 * saves. The metadata editor surfaces in edit mode via PageBuilder's toolbar slot.
 */
export default function CmsPage({
  page,
  meta,
}: {
  page: PageLayout & { layoutId: string };
  meta: PageMeta | null;
}) {
  const pathname = useLocation({ select: (l) => l.pathname });
  const router = useRouter();
  return (
    <PageBuilder
      key={page.layoutId}
      initialLayout={page}
      layoutId={page.layoutId}
      zonesLocked
      toolbar={
        <PageMetaPanel
          meta={meta}
          onSave={(patch) => {
            savePageMeta(pathname, patch)
              .then(() => router.invalidate())
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

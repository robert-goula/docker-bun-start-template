import { useLocation, useRouter } from "@tanstack/react-router";
import PageBuilder from "@/components/PageBuilder";
import { savePage, setPageLayout } from "@/lib/loadPage";
import type { PageLayout } from "@/components/Zone";

/**
 * Renders a CMS page's widgets and wires the authoring actions. Used by both the home
 * index and the dynamic slug route — locale + slug come from the loader (router context),
 * so this component just needs the resolved layout and the current pathname for saves.
 */
export default function CmsPage({ page }: { page: PageLayout & { layoutId: string } }) {
  const pathname = useLocation({ select: (l) => l.pathname });
  const router = useRouter();
  return (
    <PageBuilder
      key={page.layoutId}
      initialLayout={page}
      layoutId={page.layoutId}
      zonesLocked
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

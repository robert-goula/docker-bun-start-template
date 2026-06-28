import type { ReactNode } from "react";
import CmsPage from "@/components/CmsPage";
import type { PageLayout } from "@/components/Zone";
import type { PageRef } from "@/lib/loadPage";
import type { PageMeta } from "@/server/services/PageRepo";

/**
 * Renders an admin screen inside the page-builder chrome (the "admin" layout's nav/hero/
 * footer zones), with the screen's own UI passed as children between the hero and main
 * zones. `embedded` so the builder nests inside the admin layout route's <main>. Admin pages
 * are route-owned "system" pages: `meta` carries the per-locale title (for the browser tab and
 * the edit-mode title field) but no SEO. The CMS page/layout/meta come from loadAdminPage.
 */
export default function AdminCmsPage({
  pageRef,
  layout,
  meta,
  children,
}: {
  pageRef: PageRef;
  layout: PageLayout & { layoutId: string };
  meta: PageMeta | null;
  children: ReactNode;
}) {
  return (
    <CmsPage ref={pageRef} page={layout} meta={meta}>
      {children}
    </CmsPage>
  );
}

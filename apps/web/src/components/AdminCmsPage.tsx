import type { ReactNode } from "react";
import CmsPage from "@/components/CmsPage";
import type { PageLayout } from "@/components/Zone";
import type { PageRef } from "@/lib/loadPage";

/**
 * Renders an admin screen inside the page-builder chrome (the "admin" layout's nav/hero/
 * footer zones), with the screen's own UI passed as children between the hero and main
 * zones. `embedded` so the builder nests inside the admin layout route's <main>; admin
 * screens carry no SEO metadata, so `meta` is always null. The CMS page/layout come from
 * the route loader via loadAdminPage.
 */
export default function AdminCmsPage({
  pageRef,
  layout,
  children,
}: {
  pageRef: PageRef;
  layout: PageLayout & { layoutId: string };
  children: ReactNode;
}) {
  return (
    <CmsPage ref={pageRef} page={layout} meta={null} >
      {children}
    </CmsPage>
  );
}

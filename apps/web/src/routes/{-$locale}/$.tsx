import { createFileRoute } from "@tanstack/react-router";
import CmsPage from "@/components/CmsPage";
import { buildPageHead, loadCmsPage } from "@/lib/loadPage";

// Dynamic CMS page by slug: "/about", "/es-us/about", nested paths, etc. The resolver
// (context.i18n) supplies the canonical { locale, slug }; an unknown slug 404s in the
// loader. Reads context.i18n, never the structural splat/locale params.
export const Route = createFileRoute("/{-$locale}/$")({
  loader: ({ context }) =>
    loadCmsPage(context.queryClient, {
      slug: context.i18n.path,
      locale: context.i18n.locale,
    }),
  head: ({ loaderData }) =>
    loaderData ? buildPageHead(loaderData.ref, loaderData.meta, loaderData.siteName) : {},
  component: RouteComponent,
});

function RouteComponent() {
  const { layout, meta, ref } = Route.useLoaderData();
  return <CmsPage ref={ref} page={layout} meta={meta} />;
}

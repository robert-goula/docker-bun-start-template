import { createFileRoute } from "@tanstack/react-router";
import CmsPage from "@/components/CmsPage";
import { buildPageHead, loadCmsPage } from "@/lib/loadPage";

// Home for each locale: "/" (default) and "/{locale}". Slug + locale come from the
// root resolver via context.i18n, not from the route params.
export const Route = createFileRoute("/{-$locale}/")({
  loader: ({ context }) =>
    loadCmsPage(context.queryClient, {
      slug: context.i18n.path,
      locale: context.i18n.locale,
    }),
  head: ({ loaderData }) => (loaderData ? buildPageHead(loaderData.ref, loaderData.meta) : {}),
  component: RouteComponent,
});

function RouteComponent() {
  const { layout, meta, ref } = Route.useLoaderData();
  return <CmsPage ref={ref} page={layout} meta={meta} />;
}

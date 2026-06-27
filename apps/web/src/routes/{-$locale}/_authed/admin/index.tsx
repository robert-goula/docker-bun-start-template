import { createFileRoute } from "@tanstack/react-router";
import { useIntlayer } from "react-intlayer";
import AdminCmsPage from "@/components/AdminCmsPage";
import { loadAdminPage } from "@/lib/loadPage";

const PAGE_SLUG = "/admin";

export const Route = createFileRoute("/{-$locale}/_authed/admin/")({
  loader: async ({ context }) => {
    const ref = { slug: PAGE_SLUG, locale: context.i18n.locale };
    const layout = await loadAdminPage(context.queryClient, ref);
    return { layout, ref };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { layout, ref } = Route.useLoaderData();
  return (
    <AdminCmsPage pageRef={ref} layout={layout}>
      <Dashboard />
    </AdminCmsPage>
  );
}

function Dashboard() {
  const content = useIntlayer("adminHome");
  return <p>{content.heading}</p>;
}

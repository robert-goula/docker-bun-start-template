import { createFileRoute, useLocation, useRouter } from "@tanstack/react-router";
import PageBuilder from "@/components/PageBuilder";
import { loadPage, savePage, setPageLayout } from "@/lib/loadPage";

export const Route = createFileRoute("/")({
  loader: ({ context, location }) => loadPage(context.queryClient, location.pathname),
  component: App,
});

function App() {
  const page = Route.useLoaderData();
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

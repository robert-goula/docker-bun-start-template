import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { formDevtoolsPlugin } from "@tanstack/react-form-devtools";
import { Toaster } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import Footer from "../components/Footer";
import Header from "../components/Header";
import PasswordRehashedBanner from "../components/PasswordRehashedBanner";
import { EditModeProvider } from "../components/EditMode";
import { meQueryOptions } from "@/server/fns/auth";
import { themeQueryOptions } from "@/server/fns/theme";
import { sizeQueryOptions } from "@/server/fns/size";
import { accentQueryOptions } from "@/server/fns/accent";

import appCss from "../styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context }) => {
    const [theme, size, accent] = await Promise.all([
      context.queryClient.ensureQueryData(themeQueryOptions()),
      context.queryClient.ensureQueryData(sizeQueryOptions()),
      context.queryClient.ensureQueryData(accentQueryOptions()),
      context.queryClient.prefetchQuery(meQueryOptions()),
    ]);
    return { theme, size, accent };
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "TanStack Start Starter",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const { theme, size, accent } = Route.useRouteContext();
  return (
    <html
      lang="en"
      // className={theme.resolved}
      data-theme={theme.mode === "system" ? undefined : theme.mode}
      data-size={size}
      data-accent={accent}
      // style={{ colorScheme: theme.resolved }}
      suppressHydrationWarning
    >
      <head>
        <HeadContent />
      </head>
      <body>
        <EditModeProvider>
          <Header />
          <PasswordRehashedBanner />
          {children}
          <Footer />
        </EditModeProvider>
        <Toaster theme={theme.resolved} closeButton position="top-right" />
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "TanStack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            {
              name: "TanStack Query",
              render: <ReactQueryDevtoolsPanel />,
            },
            formDevtoolsPlugin(),
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}

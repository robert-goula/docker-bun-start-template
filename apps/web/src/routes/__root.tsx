import { HeadContent, Scripts, createRootRouteWithContext, redirect } from "@tanstack/react-router";
import { IntlayerProvider } from "react-intlayer";
import { getHTMLTextDir } from "intlayer";
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
import { intlayerLocale, resolveLocale } from "@/lib/locale";

import appCss from "../styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context, location }) => {
    // Resolve locale from the pathname before render — request-scoped, no module
    // global. A redundant default-locale prefix is canonicalized away here.
    const i18n = resolveLocale(location.pathname);
    if (i18n.redirect !== undefined) throw redirect({ href: i18n.redirect });

    const [theme, size, accent] = await Promise.all([
      context.queryClient.ensureQueryData(themeQueryOptions()),
      context.queryClient.ensureQueryData(sizeQueryOptions()),
      context.queryClient.ensureQueryData(accentQueryOptions()),
      context.queryClient.prefetchQuery(meQueryOptions()),
    ]);
    return { theme, size, accent, i18n: { locale: i18n.locale, path: i18n.path } };
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
  const { theme, size, accent, i18n } = Route.useRouteContext();
  return (
    <html
      lang={i18n.locale}
      dir={getHTMLTextDir(intlayerLocale(i18n.locale))}
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
        <IntlayerProvider locale={i18n.locale}>
          <EditModeProvider>
            <Header />
            <PasswordRehashedBanner />
            {children}
            <Footer />
          </EditModeProvider>
        </IntlayerProvider>
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

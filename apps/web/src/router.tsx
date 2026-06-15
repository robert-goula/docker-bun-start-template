import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { QueryClient } from "@tanstack/react-query";
import qs from "qs";
import { routeTree } from "./routeTree.gen";

// JSON:API-style search serialization. qs round-trips the reserved `filter`/`page`
// member families as bracket notation (`filter[search]=…`, `page[number]=…`) and
// keeps flat params like `sort=-created` flat. Values are coerced back to the right
// types by each route's `validateSearch` (Zod) schema.
function parseSearch(searchStr: string): Record<string, unknown> {
  return qs.parse(searchStr, { ignoreQueryPrefix: true });
}

function stringifySearch(search: Record<string, unknown>): string {
  const str = qs.stringify(search, { encodeValuesOnly: true });
  return str ? `?${str}` : "";
}

export function getRouter() {
  const queryClient = new QueryClient();

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    parseSearch,
    stringifySearch,
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

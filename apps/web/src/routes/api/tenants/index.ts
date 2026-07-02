import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import qs from "qs";
import { ListTenantsSearch, selectTenantSchema, toListParams } from "@/db/schema/tenants";
import { negotiate, negotiateError } from "@/lib/APIResponse";
import { StatusCodes, StatusMessages } from "@/types/StatusCodes";

export const Route = createFileRoute("/api/tenants/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getCookie } = await import("@tanstack/react-start/server");
        const { SESSION_COOKIE, loadSessionUserFromToken } = await import("@/server/auth/session");
        const { runtime } = await import("@/server/runtime");
        const { CurrentUser } = await import("@/server/services/CurrentUser");
        const { TenantRepo } = await import("@/server/services/TenantRepo");

        const user = await loadSessionUserFromToken(getCookie(SESSION_COOKIE));
        if (!user) {
          return negotiateError(request, {
            status: StatusCodes.ClientError.Unauthorized,
            title: StatusMessages.ClientError.Unauthorized,
          });
        }

        // JSON:API query families:
        // sort=name&filter[search]=…&filter[status]=deleted&page[number]=…&page[size]=…
        const url = new URL(request.url);
        const search = ListTenantsSearch.parse(qs.parse(url.search, { ignoreQueryPrefix: true }));
        const listParams = toListParams(search);
        const { pageNumber, pageSize } = listParams;

        try {
          const result = await runtime.runPromise(
            Effect.gen(function* () {
              const repo = yield* TenantRepo;
              const { rows, totalCount } = yield* repo.list(listParams);
              return { rows: rows.map((row) => selectTenantSchema.parse(row)), totalCount };
            }).pipe(
              Effect.provideService(CurrentUser, user),
              Effect.catchTags({
                Forbidden: () =>
                  Effect.fail(
                    negotiateError(request, {
                      status: StatusCodes.ClientError.Forbidden,
                      title: StatusMessages.ClientError.Forbidden,
                    }),
                  ),
                TenantDatabaseError: () =>
                  Effect.fail(
                    negotiateError(request, {
                      status: StatusCodes.ServerError.Internal,
                      title: StatusMessages.ServerError.Internal,
                    }),
                  ),
              }),
            ),
          );
          const { rows, totalCount } = result;
          const pageCount = Math.ceil(totalCount / pageSize);
          const base = "/api/tenants";
          // Preserve sort + filter across pagination links; only page[number] changes.
          const pageLink = (n: number) =>
            `${base}?${qs.stringify(
              { ...search, page: { ...search.page, number: n } },
              { encodeValuesOnly: true },
            )}`;
          return negotiate(
            request,
            { data: rows },
            {
              data: rows.map((t) => ({ type: "tenant", id: t.id, attributes: t })),
              meta: { totalCount, pageCount, pageNumber, pageSize },
              links: {
                self: pageLink(pageNumber),
                first: pageLink(1),
                last: pageLink(pageCount),
                ...(pageNumber > 1 ? { prev: pageLink(pageNumber - 1) } : {}),
                ...(pageNumber < pageCount ? { next: pageLink(pageNumber + 1) } : {}),
              },
            },
          );
        } catch (thrown) {
          if (thrown instanceof Response) return thrown;
          throw thrown;
        }
      },
    },
  },
});

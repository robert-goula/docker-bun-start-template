import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import qs from "qs";
import {
  insertUserSchema,
  ListUsersSearch,
  selectUserSchema,
  toListParams,
} from "@/db/schema/users";
import { negotiate, negotiateError } from "@/lib/APIResponse";
import { StatusCodes, StatusMessages } from "@/types/StatusCodes";

export const Route = createFileRoute("/api/users/")({
  loader: async () => {
    const user = {};
    return {
      user,
    };
  },
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getCookie } = await import("@tanstack/react-start/server");
        const { SESSION_COOKIE, loadSessionUserFromToken } = await import("@/server/auth/session");
        const { runtime } = await import("@/server/runtime");
        const { CurrentUser } = await import("@/server/services/CurrentUser");
        const { UserRepo } = await import("@/server/services/UserRepo");

        // const { user } = useLoaderData(request);
        const user = await loadSessionUserFromToken(getCookie(SESSION_COOKIE));
        if (!user) {
          return negotiateError(request, {
            status: StatusCodes.ClientError.Unauthorized,
            title: StatusMessages.ClientError.Unauthorized,
          });
        }

        // JSON:API query families: sort=-created&filter[search]=…&page[number]=…&page[size]=…
        const url = new URL(request.url);
        const search = ListUsersSearch.parse(qs.parse(url.search, { ignoreQueryPrefix: true }));
        const listParams = toListParams(search);
        const { pageNumber, pageSize } = listParams;

        try {
          const result = await runtime.runPromise(
            Effect.gen(function* () {
              const repo = yield* UserRepo;
              const { rows, totalCount } = yield* repo.list(listParams);
              return { rows: rows.map((row) => selectUserSchema.parse(row)), totalCount };
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
                DatabaseError: () =>
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
          const base = "/api/users";
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
              data: rows.map((u) => ({ type: "user", id: u.id, attributes: u })),
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

      POST: async ({ request }) => {
        const { getCookie } = await import("@tanstack/react-start/server");
        const { SESSION_COOKIE, loadSessionUserFromToken } = await import("@/server/auth/session");

        const user = await loadSessionUserFromToken(getCookie(SESSION_COOKIE));
        if (!user) {
          return negotiateError(request, {
            status: StatusCodes.ClientError.Unauthorized,
            title: StatusMessages.ClientError.Unauthorized,
          });
        }

        const json = await request.json().catch(() => null);
        const parsed = insertUserSchema.safeParse(json);
        if (!parsed.success) {
          return negotiateError(request, {
            status: StatusCodes.ClientError.UnprocessableEntity,
            title: StatusMessages.ClientError.UnprocessableEntity,
            detail: parsed.error.issues.map((i) => i.message).join("; "),
          });
        }

        // TODO: implement user creation via UserRepo
        return negotiateError(request, {
          status: StatusCodes.ServerError.NotImplemented,
          title: StatusMessages.ServerError.NotImplemented,
        });
      },
    },
  },
});

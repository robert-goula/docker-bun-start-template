import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import qs from "qs";
import {
  insertTaxonomySchema,
  ListTaxonomiesSearch,
  selectTaxonomySchema,
  toListParams,
} from "@/db/schema/taxonomy";
import { negotiate, negotiateError } from "@/lib/APIResponse";
import { StatusCodes, StatusMessages } from "@/types/StatusCodes";

export const Route = createFileRoute("/api/taxonomy/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getCookie } = await import("@tanstack/react-start/server");
        const { SESSION_COOKIE, loadSessionUserFromToken } = await import("@/server/auth/session");
        const { runtime } = await import("@/server/runtime");
        const { CurrentUser } = await import("@/server/services/CurrentUser");
        const { TaxonomyRepo } = await import("@/server/services/TaxonomyRepo");

        const user = await loadSessionUserFromToken(getCookie(SESSION_COOKIE));
        if (!user) {
          return negotiateError(request, {
            status: StatusCodes.ClientError.Unauthorized,
            title: StatusMessages.ClientError.Unauthorized,
          });
        }

        // JSON:API query families: sort=-created&filter[search]=…&filter[parentId]=…&page[number]=…&page[size]=…
        const url = new URL(request.url);
        const search = ListTaxonomiesSearch.parse(
          qs.parse(url.search, { ignoreQueryPrefix: true }),
        );
        const listParams = toListParams(search);
        const { pageNumber, pageSize } = listParams;

        try {
          const result = await runtime.runPromise(
            Effect.gen(function* () {
              const repo = yield* TaxonomyRepo;
              const { rows, totalCount } = yield* repo.list(listParams);
              return { rows: rows.map((row) => selectTaxonomySchema.parse(row)), totalCount };
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
          const base = "/api/taxonomy";
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
              data: rows.map((t) => ({ type: "taxonomy", id: t.id, attributes: t })),
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
        const { createTaxonomyFn } = await import("@/server/fns/taxonomy");

        // Expect a JSON:API document: { data: { type, attributes } }.
        const body = (await request.json().catch(() => null)) as {
          data?: { attributes?: unknown };
        } | null;
        const attributes = body?.data?.attributes;
        if (attributes == null || typeof attributes !== "object") {
          return negotiateError(request, {
            status: StatusCodes.ClientError.UnprocessableEntity,
            title: StatusMessages.ClientError.UnprocessableEntity,
            detail: "Request body must be a JSON:API document with data.attributes.",
          });
        }

        const parsed = insertTaxonomySchema.safeParse(attributes);
        if (!parsed.success) {
          return negotiateError(request, {
            status: StatusCodes.ClientError.UnprocessableEntity,
            title: StatusMessages.ClientError.UnprocessableEntity,
            detail: parsed.error.issues.map((i) => i.message).join("; "),
          });
        }

        const titleByStatus: Record<number, string> = {
          [StatusCodes.ClientError.Unauthorized]: StatusMessages.ClientError.Unauthorized,
          [StatusCodes.ClientError.Forbidden]: StatusMessages.ClientError.Forbidden,
          [StatusCodes.ServerError.Internal]: StatusMessages.ServerError.Internal,
        };

        try {
          const created = await createTaxonomyFn({ data: parsed.data });
          return negotiate(
            request,
            { data: created },
            {
              data: { type: "taxonomy", id: created.id, attributes: created },
              links: { self: `/api/taxonomy/${created.id}` },
            },
          );
        } catch (thrown) {
          if (thrown instanceof Response) {
            return negotiateError(request, {
              status: thrown.status,
              title: titleByStatus[thrown.status] ?? "Request failed",
            });
          }
          throw thrown;
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { selectTaxonomySchema, updateTaxonomySchema, type TaxonomyId } from "@/db/schema/taxonomy";
import { jsonApiResource, negotiate, negotiateError } from "@/lib/APIResponse";
import { StatusCodes, StatusMessages } from "@/types/StatusCodes";

const titleByStatus: Record<number, string> = {
  [StatusCodes.ClientError.Unauthorized]: StatusMessages.ClientError.Unauthorized,
  [StatusCodes.ClientError.Forbidden]: StatusMessages.ClientError.Forbidden,
  [StatusCodes.ClientError.NotFound]: StatusMessages.ClientError.NotFound,
  [StatusCodes.ServerError.Internal]: StatusMessages.ServerError.Internal,
};

export const Route = createFileRoute("/api/taxonomy/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { getCookie } = await import("@tanstack/react-start/server");
        const { SESSION_COOKIE, loadSessionUserFromToken } = await import("@/server/auth/session");
        const { runtime } = await import("@/server/runtime");
        const { CurrentUser } = await import("@/server/services/CurrentUser");
        const { TaxonomyRepo } = await import("@/server/services/TaxonomyRepo");

        const user = await loadSessionUserFromToken(getCookie(SESSION_COOKIE));
        if (!user)
          return negotiateError(request, {
            status: StatusCodes.ClientError.Unauthorized,
            title: StatusMessages.ClientError.Unauthorized,
          });

        const id = params.id as TaxonomyId;
        try {
          const result = await runtime.runPromise(
            Effect.gen(function* () {
              const repo = yield* TaxonomyRepo;
              const row = yield* repo.findById(id);
              return selectTaxonomySchema.parse(row);
            }).pipe(
              Effect.provideService(CurrentUser, user),
              Effect.catchTags({
                TaxonomyNotFound: () =>
                  Effect.fail(
                    negotiateError(request, {
                      status: StatusCodes.ClientError.NotFound,
                      title: StatusMessages.ClientError.NotFound,
                    }),
                  ),
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
          return negotiate(
            request,
            { data: result },
            jsonApiResource({
              type: "taxonomy",
              id: result.id,
              attributes: result,
              links: { self: `/api/taxonomy/${id}` },
            }),
          );
        } catch (thrown) {
          if (thrown instanceof Response) return thrown;
          throw thrown;
        }
      },

      PATCH: async ({ request, params }) => {
        const { updateTaxonomyFn } = await import("@/server/fns/taxonomy");

        const id = params.id as TaxonomyId;

        // Expect a JSON:API document: { data: { type, id, attributes } }.
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

        const parsed = updateTaxonomySchema.safeParse(attributes);
        if (!parsed.success) {
          return negotiateError(request, {
            status: StatusCodes.ClientError.UnprocessableEntity,
            title: StatusMessages.ClientError.UnprocessableEntity,
            detail: parsed.error.issues.map((i) => i.message).join("; "),
          });
        }

        try {
          const updated = await updateTaxonomyFn({ data: { id, patch: parsed.data } });
          return negotiate(
            request,
            { data: updated },
            jsonApiResource({
              type: "taxonomy",
              id: updated.id,
              attributes: updated,
              links: { self: `/api/taxonomy/${id}` },
            }),
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

      DELETE: async ({ request, params }) => {
        const { deleteTaxonomyFn } = await import("@/server/fns/taxonomy");

        const id = params.id as TaxonomyId;
        try {
          await deleteTaxonomyFn({ data: { id } });
          return negotiate(
            request,
            { data: { id, deleted: true } },
            { data: { type: "taxonomy", id, attributes: { deleted: true } } },
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

import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { selectTenantSchema, updateTenantSchema, type TenantId } from "@/db/schema/tenants";
import { jsonApiResource, negotiate, negotiateError } from "@/lib/APIResponse";
import { StatusCodes, StatusMessages } from "@/types/StatusCodes";

export const Route = createFileRoute("/api/tenants/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { getCookie } = await import("@tanstack/react-start/server");
        const { SESSION_COOKIE, loadSessionUserFromToken } = await import("@/server/auth/session");
        const { runtime } = await import("@/server/runtime");
        const { CurrentUser } = await import("@/server/services/CurrentUser");
        const { TenantRepo } = await import("@/server/services/TenantRepo");

        const user = await loadSessionUserFromToken(getCookie(SESSION_COOKIE));
        if (!user)
          return negotiateError(request, {
            status: StatusCodes.ClientError.Unauthorized,
            title: StatusMessages.ClientError.Unauthorized,
          });

        const id = params.id as TenantId;
        try {
          const result = await runtime.runPromise(
            Effect.gen(function* () {
              const repo = yield* TenantRepo;
              const row = yield* repo.findById(id);
              return selectTenantSchema.parse(row);
            }).pipe(
              Effect.provideService(CurrentUser, user),
              Effect.catchTags({
                TenantNotFound: () =>
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
          return negotiate(
            request,
            { data: result },
            jsonApiResource({
              type: "tenant",
              id: result.id,
              attributes: result,
              links: { self: `/api/tenants/${id}` },
            }),
          );
        } catch (thrown) {
          if (thrown instanceof Response) return thrown;
          throw thrown;
        }
      },

      PATCH: async ({ request, params }) => {
        const { updateTenantFn } = await import("@/server/fns/tenants");

        const id = params.id as TenantId;

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

        const parsed = updateTenantSchema.safeParse(attributes);
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
          [StatusCodes.ClientError.NotFound]: StatusMessages.ClientError.NotFound,
          [StatusCodes.ClientError.Conflict]: StatusMessages.ClientError.Conflict,
          [StatusCodes.ServerError.Internal]: StatusMessages.ServerError.Internal,
        };

        try {
          const updated = await updateTenantFn({ data: { id, patch: parsed.data } });
          return negotiate(
            request,
            { data: updated },
            jsonApiResource({
              type: "tenant",
              id: updated.id,
              attributes: updated,
              links: { self: `/api/tenants/${id}` },
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
    },
  },
});

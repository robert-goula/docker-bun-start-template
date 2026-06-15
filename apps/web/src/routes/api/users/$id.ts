import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { selectUserSchema, updateUserSchema, type UserId } from "@/db/schema/users";
import { jsonApiResource, negotiate, negotiateError } from "@/lib/APIResponse";
import { StatusCodes, StatusMessages } from "@/types/StatusCodes";

export const Route = createFileRoute("/api/users/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { getCookie } = await import("@tanstack/react-start/server");
        const { SESSION_COOKIE, loadSessionUserFromToken } = await import("@/server/auth/session");
        const { runtime } = await import("@/server/runtime");
        const { CurrentUser } = await import("@/server/services/CurrentUser");
        const { UserRepo } = await import("@/server/services/UserRepo");

        const user = await loadSessionUserFromToken(getCookie(SESSION_COOKIE));
        if (!user)
          return negotiateError(request, {
            status: StatusCodes.ClientError.Unauthorized,
            title: StatusMessages.ClientError.Unauthorized,
          });

        const id = params.id as UserId;
        try {
          const result = await runtime.runPromise(
            Effect.gen(function* () {
              const repo = yield* UserRepo;
              const row = yield* repo.findById(id);
              return selectUserSchema.parse(row);
            }).pipe(
              Effect.provideService(CurrentUser, user),
              Effect.catchTags({
                UserNotFound: () =>
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
              type: "user",
              id: result.id,
              attributes: result,
              links: { self: `/api/users/${id}` },
            }),
          );
        } catch (thrown) {
          if (thrown instanceof Response) return thrown;
          throw thrown;
        }
      },

      PATCH: async ({ request, params }) => {
        const { updateUserFn } = await import("@/server/fns/users");

        const id = params.id as UserId;

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

        const parsed = updateUserSchema.safeParse(attributes);
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
          [StatusCodes.ServerError.Internal]: StatusMessages.ServerError.Internal,
        };

        try {
          const updated = await updateUserFn({ data: { id, patch: parsed.data } });
          return negotiate(
            request,
            { data: updated },
            jsonApiResource({
              type: "user",
              id: updated.id,
              attributes: updated,
              links: { self: `/api/users/${id}` },
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

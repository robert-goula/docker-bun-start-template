import { createFileRoute } from "@tanstack/react-router";
import * as z from "zod";
import { negotiate, negotiateError } from "@/lib/APIResponse";
import { StatusCodes, StatusMessages } from "@/types/StatusCodes";

const LoginInput = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(255),
});

export const Route = createFileRoute("/api/auth/sessions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { setCookie } = await import("@tanstack/react-start/server");
        const { SESSION_COOKIE, COOKIE_OPTS, performLogin } = await import("@/server/auth/session");

        const json = await request.json().catch(() => null);
        const parsed = LoginInput.safeParse(json);
        if (!parsed.success) {
          return negotiateError(request, {
            status: StatusCodes.ClientError.UnprocessableEntity,
            title: StatusMessages.ClientError.UnprocessableEntity,
            detail: parsed.error.issues.map((i) => i.message).join("; "),
          });
        }

        const result = await performLogin(parsed.data.email, parsed.data.password);
        if (!result.ok) {
          return negotiateError(request, {
            status:
              result.status === 401
                ? StatusCodes.ClientError.Unauthorized
                : StatusCodes.ServerError.Internal,
            title:
              result.status === 401
                ? "Invalid email or password"
                : StatusMessages.ServerError.Internal,
          });
        }

        setCookie(SESSION_COOKIE, result.token, COOKIE_OPTS);
        return negotiate(
          request,
          { data: { user: result.user } },
          {
            data: {
              type: "session",
              id: result.user.id,
              attributes: { user: result.user },
            },
          },
          { status: StatusCodes.Success.Created },
        );
      },

      DELETE: async ({ request }) => {
        const { getCookie, setCookie } = await import("@tanstack/react-start/server");
        const { SESSION_COOKIE, COOKIE_OPTS, loadSessionUserFromToken, destroySession } =
          await import("@/server/auth/session");

        const token = getCookie(SESSION_COOKIE);
        const user = await loadSessionUserFromToken(token);
        if (!user) {
          return negotiateError(request, {
            status: StatusCodes.ClientError.Unauthorized,
            title: StatusMessages.ClientError.Unauthorized,
          });
        }

        if (token) await destroySession(token);
        setCookie(SESSION_COOKIE, "", { ...COOKIE_OPTS, maxAge: 0 });
        return new Response(null, { status: StatusCodes.Success.NoContent });
      },
    },
  },
});

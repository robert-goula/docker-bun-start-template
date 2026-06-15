import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import * as z from "zod";
import type { SessionUser } from "@/server/services/CurrentUser";

export const meQueryOptions = () =>
  queryOptions({
    queryKey: ["me"],
    queryFn: ({ signal }) => meFn({ signal }),
    staleTime: 60_000,
  });

const LoginInput = z.object({
  email: z.email().max(255),
  password: z.string().min(1).max(255),
});

export const authMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { getCookie, setCookie } = await import("@tanstack/react-start/server");
    const { SESSION_COOKIE, COOKIE_OPTS, loadSessionUserFromToken } = await import(
      "@/server/auth/session"
    );
    const token = getCookie(SESSION_COOKIE);
    const user = await loadSessionUserFromToken(token);
    if (!user) {
      if (token) setCookie(SESSION_COOKIE, "", { ...COOKIE_OPTS, maxAge: 0 });
      throw new Response("Unauthorized", { status: 401 });
    }
    setCookie(SESSION_COOKIE, token!, COOKIE_OPTS);
    return next({ context: { user } });
  },
);

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => LoginInput.parse(input))
  .handler(async ({ data }) => {
    const { setCookie, setResponseStatus } = await import("@tanstack/react-start/server");
    const { SESSION_COOKIE, COOKIE_OPTS, performLogin } = await import(
      "@/server/auth/session"
    );
    const result = await performLogin(data.email, data.password);
    if (!result.ok) {
      setResponseStatus(result.status);
      return {
        ok: false as const,
        error: result.status === 401 ? "Invalid email or password" : "Internal Server Error",
      };
    }
    setCookie(SESSION_COOKIE, result.token, COOKIE_OPTS);
    return { ok: true as const, user: result.user };
  });

export const logoutFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async () => {
    const { getCookie, setCookie } = await import("@tanstack/react-start/server");
    const { SESSION_COOKIE, COOKIE_OPTS, destroySession } = await import(
      "@/server/auth/session"
    );
    const token = getCookie(SESSION_COOKIE);
    if (token) await destroySession(token);
    setCookie(SESSION_COOKIE, "", { ...COOKIE_OPTS, maxAge: 0 });
    return { ok: true as const };
  });

export const acknowledgePasswordRehashFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { Effect } = await import("effect");
    const { runtime } = await import("@/server/runtime");
    const { CurrentUser } = await import("@/server/services/CurrentUser");
    const { UserRepo } = await import("@/server/services/UserRepo");
    await runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* UserRepo;
        yield* repo.acknowledgePasswordRehash(context.user.id);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchAll(() => Effect.succeed(undefined)),
      ),
    );
    return { ok: true as const };
  });

export const meFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionUser | null> => {
    const { getCookie, setCookie } = await import("@tanstack/react-start/server");
    const { SESSION_COOKIE, COOKIE_OPTS, loadSessionUserFromToken } = await import(
      "@/server/auth/session"
    );
    const token = getCookie(SESSION_COOKIE);
    const user = await loadSessionUserFromToken(token);
    if (!user) {
      if (token) setCookie(SESSION_COOKIE, "", { ...COOKIE_OPTS, maxAge: 0 });
      return null;
    }
    setCookie(SESSION_COOKIE, token!, COOKIE_OPTS);
    return user;
  },
);

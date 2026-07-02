import { Data, Effect, Either } from "effect";
import type { TenantId } from "@/db/schema/tenants";
import type { UserId } from "@/db/schema/users";
import { runtime } from "@/server/runtime";
import type { SessionUser } from "@/server/services/CurrentUser";
import { logger } from "@/server/services/Logger";
import { parseEncoded, PasswordHasher, TARGET_PARAMS } from "@/server/services/PasswordHasher";
import { SESSION_TTL_SECONDS, SessionStore } from "@/server/services/SessionStore";
import { UserRepo } from "@/server/services/UserRepo";

export const SESSION_COOKIE = "session";

export const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

class InvalidCredentials extends Data.TaggedError("InvalidCredentials") {}

export type LoginResult =
  | { ok: true; token: string; user: SessionUser }
  | { ok: false; status: 401 | 500 };

export function loadSessionUserFromToken(
  token: string | undefined,
): Promise<SessionUser | null> {
  if (!token) return Promise.resolve(null);
  return runtime.runPromise(
    Effect.gen(function* () {
      const sessions = yield* SessionStore;
      const userId = yield* sessions.touch(token);
      if (!userId) return null;
      const repo = yield* UserRepo;
      const user = yield* repo.findByIdInternal(userId);
      if (!user) return null;
      return {
        id: user.id as UserId,
        email: user.email,
        roles: user.roles,
        passwordRehashedAt: user.passwordRehashedAt ?? null,
        tenantId: (user.tenantId ?? null) as TenantId | null,
        availableTenants: user.availableTenants ?? [],
      } satisfies SessionUser;
    }).pipe(Effect.catchAll(() => Effect.succeed(null as SessionUser | null))),
  );
}

export async function performLogin(
  email: string,
  password: string,
): Promise<LoginResult> {
  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const repo = yield* UserRepo;
      const sessions = yield* SessionStore;
      const row = yield* repo.findByEmail(email);
      if (!row || !row.password) {
        return yield* Effect.fail(new InvalidCredentials());
      }
      const ok = yield* Effect.tryPromise({
        try: () => PasswordHasher.verify(password, row.password!),
        catch: () => new InvalidCredentials(),
      });
      if (!ok) return yield* Effect.fail(new InvalidCredentials());
      const userId = row.id as UserId;

      let passwordRehashedAt = row.passwordRehashedAt ?? null;
      if (PasswordHasher.needsRehash(row.password)) {
        const fromParams = parseEncoded(row.password);
        const rehashResult = yield* Effect.tryPromise({
          try: () => PasswordHasher.hash(password),
          catch: (cause) => cause,
        }).pipe(Effect.either);
        if (Either.isRight(rehashResult)) {
          const newHash = rehashResult.right;
          const updateResult = yield* repo
            .updatePasswordHashInternal(userId, newHash)
            .pipe(Effect.either);
          if (Either.isRight(updateResult)) {
            passwordRehashedAt = new Date();
            logger.info(
              {
                event: "password_rehash",
                userId,
                fromParams,
                toParams: {
                  algorithm: TARGET_PARAMS.algorithm,
                  memoryCost: TARGET_PARAMS.memoryCost,
                  timeCost: TARGET_PARAMS.timeCost,
                },
              },
              "upgraded password hash to current parameters",
            );
          } else {
            logger.warn(
              { event: "password_rehash_persist_failed", userId },
              "password rehash succeeded but DB update failed",
            );
          }
        } else {
          logger.warn(
            { event: "password_rehash_failed", userId },
            "password rehash failed during login",
          );
        }
      }

      const { token } = yield* sessions.create(userId);
      return {
        token,
        user: {
          id: userId,
          email: row.email,
          roles: row.roles,
          passwordRehashedAt,
          tenantId: (row.tenantId ?? null) as TenantId | null,
          availableTenants: row.availableTenants ?? [],
        } satisfies SessionUser,
      };
    }).pipe(Effect.either),
  );

  if (Either.isLeft(result)) {
    const tag = result.left._tag;
    if (tag === "InvalidCredentials" || tag === "DatabaseError") {
      return { ok: false, status: 401 };
    }
    return { ok: false, status: 500 };
  }
  return { ok: true, token: result.right.token, user: result.right.user };
}

export function destroySession(token: string): Promise<void> {
  return runtime.runPromise(
    Effect.gen(function* () {
      const sessions = yield* SessionStore;
      yield* sessions.destroy(token);
    }).pipe(
      Effect.catchAll(() => Effect.succeed(undefined)),
      Effect.asVoid,
    ),
  );
}

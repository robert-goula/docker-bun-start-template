import { Data, Effect } from "effect";
import type { UserId } from "@/db/schema/users";
import { Redis, RedisLive } from "./Redis";

export class SessionError extends Data.TaggedError("SessionError")<{
  readonly cause: unknown;
}> {}

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const PREFIX = "session:";

function generateToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  let binary = "";
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export class SessionStore extends Effect.Service<SessionStore>()("app/SessionStore", {
  effect: Effect.gen(function* () {
    const redis = yield* Redis;

    const create = (userId: UserId) =>
      Effect.gen(function* () {
        const token = generateToken();
        yield* Effect.tryPromise({
          try: () => redis.set(PREFIX + token, userId, "EX", SESSION_TTL_SECONDS),
          catch: (cause) => new SessionError({ cause }),
        });
        return { token, ttlSeconds: SESSION_TTL_SECONDS };
      });

    const touch = (token: string) =>
      Effect.tryPromise({
        try: async () => {
          const userId = await redis.get(PREFIX + token);
          if (!userId) return null;
          await redis.expire(PREFIX + token, SESSION_TTL_SECONDS);
          return userId as UserId;
        },
        catch: (cause) => new SessionError({ cause }),
      });

    const destroy = (token: string) =>
      Effect.tryPromise({
        try: () => redis.del(PREFIX + token).then(() => undefined),
        catch: (cause) => new SessionError({ cause }),
      });

    return { create, touch, destroy } as const;
  }),
  dependencies: [RedisLive],
}) {}

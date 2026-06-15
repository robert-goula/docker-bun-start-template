import { RedisClient } from "bun";
import { Config, Context, Effect, Layer, Redacted } from "effect";

export class Redis extends Context.Tag("app/Redis")<Redis, RedisClient>() {}

export const RedisLive = Layer.scoped(
  Redis,
  Effect.gen(function* () {
    const url = yield* Config.redacted("REDIS_URL");
    const client = new RedisClient(Redacted.value(url));
    yield* Effect.promise(() => client.connect());
    yield* Effect.addFinalizer(() => Effect.sync(() => client.close()));
    return client;
  }),
);

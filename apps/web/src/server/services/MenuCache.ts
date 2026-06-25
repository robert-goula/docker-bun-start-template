import { Effect } from "effect";
import type { MenuRender } from "@/db/schema/menus";
import type { Locale } from "@/db/schema/pages";
import { Redis, RedisLive } from "./Redis";

// Resolved menu projections are cached by (menuId, locale). Rather than tracking and deleting
// every affected key on a write, a single global version counter is bumped on any change that
// could affect a rendered menu (a menu edit, or a referenced page's slug/title change). The
// version is part of each cache key, so a bump makes every previously-cached entry unreachable
// at once; the orphaned keys expire on their own via the TTL. This keeps invalidation O(1) and
// always correct (the user-chosen "invalidate on menu + page edits").
const VERSION_KEY = "menu:render:ver";
const TTL_SECONDS = 60 * 60; // safety net for orphaned keys; correctness comes from the bump

const renderKey = (version: string, menuId: string, locale: Locale) =>
  `menu:render:${version}:${menuId}:${locale}`;

export class MenuCache extends Effect.Service<MenuCache>()("app/MenuCache", {
  effect: Effect.gen(function* () {
    const redis = yield* Redis;

    // Caching is best-effort: a Redis hiccup must never break (or fail) menu rendering, so
    // every operation swallows its own errors — a read miss falls through to the database, a
    // failed write/bump just means the next render recomputes.
    const get = (menuId: string, locale: Locale) =>
      Effect.promise(async (): Promise<MenuRender | null> => {
        try {
          const version = (await redis.get(VERSION_KEY)) ?? "0";
          const raw = await redis.get(renderKey(version, menuId, locale));
          return raw ? (JSON.parse(raw) as MenuRender) : null;
        } catch {
          return null;
        }
      });

    const set = (menuId: string, locale: Locale, value: MenuRender) =>
      Effect.promise(async () => {
        try {
          const version = (await redis.get(VERSION_KEY)) ?? "0";
          await redis.set(
            renderKey(version, menuId, locale),
            JSON.stringify(value),
            "EX",
            TTL_SECONDS,
          );
        } catch {
          // best-effort
        }
      });

    // Bump the global version so every cached projection is bypassed from now on.
    const invalidate = Effect.promise(async () => {
      try {
        await redis.incr(VERSION_KEY);
      } catch {
        // best-effort
      }
    });

    return { get, set, invalidate } as const;
  }),
  dependencies: [RedisLive],
}) {}

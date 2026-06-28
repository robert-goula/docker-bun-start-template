import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import * as z from "zod";
import { siteNameSchema } from "@/config/registry";
import { insertConfigSchema, selectConfigSchema } from "@/db/schema/config";
import type { ConfigId } from "@/db/schema/config";
import { authMiddleware } from "@/server/fns/auth";
import { runtime } from "@/server/runtime";
import { ConfigRepo } from "@/server/services/ConfigRepo";
import { CurrentUser } from "@/server/services/CurrentUser";

export type SafeConfig = z.infer<typeof selectConfigSchema>;

const ConfigIdInput = z.object({ id: insertConfigSchema.shape.id });

const SetConfigArgs = insertConfigSchema;

const forbidden = () => Effect.fail(new Response("Forbidden", { status: 403 }));
const notFound = () => Effect.fail(new Response("Not Found", { status: 404 }));
const dbError = () => Effect.fail(new Response("Internal Server Error", { status: 500 }));
const badValue = (e: { readonly message: string }) =>
  Effect.fail(new Response(e.message, { status: 400 }));

export const listConfigFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* ConfigRepo;
        const rows = yield* repo.list;
        return rows.map((row) => selectConfigSchema.parse(row));
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({ Forbidden: forbidden, DatabaseError: dbError }),
      ),
    ),
  );

// Public (no auth): the localized site name for the page <head> title. Returns {} when unset
// so the head can fall back gracefully. Safe to expose — it's already visible in every tab.
export const getSiteNameFn = createServerFn({ method: "GET" }).handler(() =>
  runtime.runPromise(
    Effect.gen(function* () {
      const repo = yield* ConfigRepo;
      const value = yield* repo.getPublicValue("site.name" as ConfigId);
      return siteNameSchema.parse(value ?? {});
    }).pipe(Effect.catchTags({ DatabaseError: dbError })),
  ),
);

export const getConfigFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => ConfigIdInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* ConfigRepo;
        const row = yield* repo.get(data.id as ConfigId);
        return selectConfigSchema.parse(row);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({
          ConfigNotFound: notFound,
          Forbidden: forbidden,
          DatabaseError: dbError,
        }),
      ),
    ),
  );

export const setConfigFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SetConfigArgs.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* ConfigRepo;
        const row = yield* repo.set(data.id as ConfigId, {
          value: data.value,
          description: data.description ?? null,
        });
        return selectConfigSchema.parse(row);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({
          ConfigNotFound: notFound,
          ConfigValidationError: badValue,
          Forbidden: forbidden,
          DatabaseError: dbError,
        }),
      ),
    ),
  );

export const removeConfigFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ConfigIdInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* ConfigRepo;
        return yield* repo.remove(data.id as ConfigId);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({
          ConfigNotFound: notFound,
          Forbidden: forbidden,
          DatabaseError: dbError,
        }),
      ),
    ),
  );

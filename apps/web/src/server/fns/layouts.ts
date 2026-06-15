import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import * as z from "zod";
import { type LayoutId, selectLayoutSchema } from "@/db/schema/layouts";
import { layoutZoneOptionsSchema } from "@/db/schema/layoutZones";
import { ZONE_NAMES } from "@/db/schema/zones";
import { authMiddleware } from "@/server/fns/auth";
import { runtime } from "@/server/runtime";
import { CurrentUser } from "@/server/services/CurrentUser";
import { LayoutRepo } from "@/server/services/LayoutRepo";

const layoutZoneDetailSchema = z.object({
  zoneId: z.uuid(),
  name: z.enum(ZONE_NAMES),
  options: layoutZoneOptionsSchema,
});

// A layout plus its zone instances — the shape the admin edit page consumes.
const selectLayoutDetailSchema = selectLayoutSchema.extend({
  zones: z.array(layoutZoneDetailSchema),
});
export type SafeLayout = z.infer<typeof selectLayoutSchema>;
export type SafeLayoutDetail = z.infer<typeof selectLayoutDetailSchema>;

const LayoutIdInput = z.object({ id: z.uuid() });

const CreateLayoutInput = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).nullable().optional(),
});

// Editable attributes for a PATCH; every field is optional so only changes are sent.
export const updateLayoutAttributesSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  zones: z.array(z.object({ zoneId: z.uuid(), options: layoutZoneOptionsSchema })).optional(),
});
export type UpdateLayoutAttributes = z.infer<typeof updateLayoutAttributesSchema>;

const UpdateLayoutArgs = z.object({ id: z.uuid(), patch: updateLayoutAttributesSchema });

const forbidden = () => Effect.fail(new Response("Forbidden", { status: 403 }));
const notFound = () => Effect.fail(new Response("Not Found", { status: 404 }));
const dbError = () => Effect.fail(new Response("Internal Server Error", { status: 500 }));

export const listLayoutsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* LayoutRepo;
        const rows = yield* repo.list;
        return rows.map((row) => selectLayoutSchema.parse(row));
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({ Forbidden: forbidden, DatabaseError: dbError }),
      ),
    ),
  );

export const getLayoutByIdFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => LayoutIdInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* LayoutRepo;
        const layout = yield* repo.findDetail(data.id as LayoutId);
        return selectLayoutDetailSchema.parse(layout);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({
          LayoutNotFound: notFound,
          Forbidden: forbidden,
          DatabaseError: dbError,
        }),
      ),
    ),
  );

export const createLayoutFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CreateLayoutInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* LayoutRepo;
        const created = yield* repo.create(data);
        return selectLayoutDetailSchema.parse(created);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({ Forbidden: forbidden, DatabaseError: dbError }),
      ),
    ),
  );

export const updateLayoutFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UpdateLayoutArgs.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* LayoutRepo;
        const updated = yield* repo.update(data.id as LayoutId, data.patch);
        return selectLayoutDetailSchema.parse(updated);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({
          LayoutNotFound: notFound,
          Forbidden: forbidden,
          DatabaseError: dbError,
        }),
      ),
    ),
  );

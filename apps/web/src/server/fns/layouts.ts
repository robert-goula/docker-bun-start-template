import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import * as z from "zod";
import { type LayoutId, selectLayoutSchema } from "@/db/schema/layouts";
import { layoutZoneOptionsSchema } from "@/db/schema/layoutZones";
import { LOCALES } from "@/db/schema/pages";
import { ZONE_NAMES } from "@/db/schema/zones";
import { authMiddleware } from "@/server/fns/auth";
import { pageLayoutSchema } from "@/server/fns/pages";
import { runtime } from "@/server/runtime";
import { CurrentUser } from "@/server/services/CurrentUser";
import { LayoutRepo } from "@/server/services/LayoutRepo";
import { LayoutWidgetRepo } from "@/server/services/LayoutWidgetRepo";
import type { PageLayout } from "@/components/Zone";

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

// Identifies a layout-default widget scope: the layout plus a target locale, or null
// for the all-locales defaults (rendered on every locale).
const LayoutWidgetScopeInput = z.object({
  layoutId: z.uuid(),
  locale: z.enum(LOCALES).nullable(),
});

// Loads the layout's zone arrangement filled with its default widgets for one scope,
// shaped as a PageLayout so the admin editor reuses the same PageBuilder as pages.
export const loadLayoutWidgetsFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => LayoutWidgetScopeInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* LayoutWidgetRepo;
        return yield* repo.getForScope({
          layoutId: data.layoutId as LayoutId,
          locale: data.locale,
        });
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({ Forbidden: forbidden, DatabaseError: dbError }),
      ),
    ),
  );

const SaveLayoutWidgetsArgs = LayoutWidgetScopeInput.extend({ layout: pageLayoutSchema });

// Persists the layout's default widgets for one scope. Admin-gated like the other
// layout writes; zone arrangement is owned by the layout and never written here.
export const saveLayoutWidgetsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SaveLayoutWidgetsArgs.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* LayoutWidgetRepo;
        yield* repo.saveForScope(
          { layoutId: data.layoutId as LayoutId, locale: data.locale },
          data.layout as PageLayout,
        );
        return { ok: true } as const;
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({ Forbidden: forbidden, DatabaseError: dbError }),
      ),
    ),
  );

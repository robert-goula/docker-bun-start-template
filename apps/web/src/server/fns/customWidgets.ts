import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import * as z from "zod";
import {
  type CustomWidgetId,
  customWidgetFieldsSchema,
  selectCustomWidgetSchema,
} from "@/db/schema/customWidgets";
import { authMiddleware } from "@/server/fns/auth";
import { runtime } from "@/server/runtime";
import { CurrentUser } from "@/server/services/CurrentUser";
import { CustomWidgetRepo } from "@/server/services/CustomWidgetRepo";

export type SafeCustomWidget = z.infer<typeof selectCustomWidgetSchema>;

const CustomWidgetIdInput = z.object({ id: z.uuid() });

const CreateCustomWidgetInput = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).nullable().optional(),
});

// Editable attributes for a patch; every field optional so only changes are sent.
export const updateCustomWidgetAttributesSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  slug: z.string().min(1).max(80).optional(),
  template: z.string().max(40).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  fields: customWidgetFieldsSchema.optional(),
});
export type UpdateCustomWidgetAttributes = z.infer<typeof updateCustomWidgetAttributesSchema>;

const UpdateCustomWidgetArgs = z.object({
  id: z.uuid(),
  patch: updateCustomWidgetAttributesSchema,
});

const forbidden = () => Effect.fail(new Response("Forbidden", { status: 403 }));
const notFound = () => Effect.fail(new Response("Not Found", { status: 404 }));
const dbError = () => Effect.fail(new Response("Internal Server Error", { status: 500 }));

export const listCustomWidgetsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* CustomWidgetRepo;
        const rows = yield* repo.list;
        return rows.map((row) => selectCustomWidgetSchema.parse(row));
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({ Forbidden: forbidden, DatabaseError: dbError }),
      ),
    ),
  );

export const getCustomWidgetByIdFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => CustomWidgetIdInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* CustomWidgetRepo;
        const row = yield* repo.findById(data.id as CustomWidgetId);
        return selectCustomWidgetSchema.parse(row);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({
          CustomWidgetNotFound: notFound,
          Forbidden: forbidden,
          DatabaseError: dbError,
        }),
      ),
    ),
  );

export const createCustomWidgetFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CreateCustomWidgetInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* CustomWidgetRepo;
        const created = yield* repo.create(data);
        return selectCustomWidgetSchema.parse(created);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({ Forbidden: forbidden, DatabaseError: dbError }),
      ),
    ),
  );

export const updateCustomWidgetFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UpdateCustomWidgetArgs.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* CustomWidgetRepo;
        const updated = yield* repo.update(data.id as CustomWidgetId, data.patch);
        return selectCustomWidgetSchema.parse(updated);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({
          CustomWidgetNotFound: notFound,
          Forbidden: forbidden,
          DatabaseError: dbError,
        }),
      ),
    ),
  );

export const deleteCustomWidgetFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CustomWidgetIdInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* CustomWidgetRepo;
        yield* repo.remove(data.id as CustomWidgetId);
        return { ok: true } as const;
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({
          CustomWidgetNotFound: notFound,
          Forbidden: forbidden,
          DatabaseError: dbError,
        }),
      ),
    ),
  );

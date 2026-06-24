import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import * as z from "zod";
import {
  type MenuId,
  type MenuRender,
  menuItemsSchema,
  menuRenderSchema,
  selectMenuSchema,
} from "@/db/schema/menus";
import { LOCALES } from "@/db/schema/pages";
import { authMiddleware } from "@/server/fns/auth";
import { runtime } from "@/server/runtime";
import { CurrentUser } from "@/server/services/CurrentUser";
import { MenuRepo } from "@/server/services/MenuRepo";

export type SafeMenu = z.infer<typeof selectMenuSchema>;

const MenuIdInput = z.object({ id: z.uuid() });

const CreateMenuInput = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).nullable().optional(),
});

// Editable attributes for a patch; every field optional so only changes are sent.
export const updateMenuAttributesSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  slug: z.string().min(1).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  items: menuItemsSchema.optional(),
});
export type UpdateMenuAttributes = z.infer<typeof updateMenuAttributesSchema>;

const UpdateMenuArgs = z.object({
  id: z.uuid(),
  patch: updateMenuAttributesSchema,
});

// Render input: which menu, and the locale to bake it for (the page's locale).
const MenuRenderInput = z.object({ id: z.uuid(), locale: z.enum(LOCALES) });

const forbidden = () => Effect.fail(new Response("Forbidden", { status: 403 }));
const notFound = () => Effect.fail(new Response("Not Found", { status: 404 }));
const dbError = () => Effect.fail(new Response("Internal Server Error", { status: 500 }));

export const listMenusFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* MenuRepo;
        const rows = yield* repo.list;
        return rows.map((row) => selectMenuSchema.parse(row));
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({ Forbidden: forbidden, DatabaseError: dbError }),
      ),
    ),
  );

export const getMenuByIdFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => MenuIdInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* MenuRepo;
        const row = yield* repo.findById(data.id as MenuId);
        return selectMenuSchema.parse(row);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({ MenuNotFound: notFound, Forbidden: forbidden, DatabaseError: dbError }),
      ),
    ),
  );

// PUBLIC (no auth): the locale-baked render projection, used to server-render placed menu
// widgets on public pages. Never throws — a missing/unreadable menu resolves to `null` so a
// single bad widget can't 500 a public page (and SSR dehydration carries no error).
export const getMenuForRenderFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => MenuRenderInput.parse(input))
  .handler(({ data }): Promise<MenuRender | null> =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* MenuRepo;
        const resolved = yield* repo.findForRender(data.id as MenuId, data.locale);
        return menuRenderSchema.parse(resolved);
      }).pipe(
        Effect.catchTags({
          MenuNotFound: () => Effect.succeed(null),
          DatabaseError: () => Effect.succeed(null),
        }),
      ),
    ),
  );

export const createMenuFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CreateMenuInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* MenuRepo;
        const created = yield* repo.create(data);
        return selectMenuSchema.parse(created);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({ Forbidden: forbidden, DatabaseError: dbError }),
      ),
    ),
  );

export const updateMenuFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UpdateMenuArgs.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* MenuRepo;
        const updated = yield* repo.update(data.id as MenuId, data.patch);
        return selectMenuSchema.parse(updated);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({ MenuNotFound: notFound, Forbidden: forbidden, DatabaseError: dbError }),
      ),
    ),
  );

export const deleteMenuFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => MenuIdInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* MenuRepo;
        yield* repo.remove(data.id as MenuId);
        return { ok: true } as const;
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({ MenuNotFound: notFound, Forbidden: forbidden, DatabaseError: dbError }),
      ),
    ),
  );

import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import * as z from "zod";
import {
  insertTenantSchema,
  ListTenantsInput,
  selectTenantSchema,
  updateTenantSchema,
  type ListTenantsPagedMeta,
  type PageSize,
  type TenantId,
} from "@/db/schema/tenants";
import { authMiddleware } from "@/server/fns/auth";
import { runtime } from "@/server/runtime";
import { CurrentUser } from "@/server/services/CurrentUser";
import { TenantRepo } from "@/server/services/TenantRepo";

const TenantIdInput = z.object({ id: z.uuidv7() });
const UpdateTenantArgs = z.object({ id: z.uuidv7(), patch: updateTenantSchema });

const forbidden = () => Effect.fail(new Response("Forbidden", { status: 403 }));
const notFound = () => Effect.fail(new Response("Not Found", { status: 404 }));
const conflict = () => Effect.fail(new Response("Conflict", { status: 409 }));
const unprocessable = () => Effect.fail(new Response("Unprocessable Entity", { status: 422 }));
const dbError = () => Effect.fail(new Response("Internal Server Error", { status: 500 }));

export const listTenantsFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => ListTenantsInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* TenantRepo;
        const { rows, totalCount } = yield* repo.list(data);
        const pageCount = Math.ceil(totalCount / data.pageSize);
        const meta: ListTenantsPagedMeta = {
          totalCount,
          pageCount,
          pageNumber: data.pageNumber,
          pageSize: data.pageSize as PageSize,
        };
        return { data: rows.map((row) => selectTenantSchema.parse(row)), meta };
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({ Forbidden: forbidden, TenantDatabaseError: dbError }),
      ),
    ),
  );

export const getTenantByIdFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TenantIdInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* TenantRepo;
        const row = yield* repo.findById(data.id as TenantId);
        return selectTenantSchema.parse(row);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({
          TenantNotFound: notFound,
          Forbidden: forbidden,
          TenantDatabaseError: dbError,
        }),
      ),
    ),
  );

export const createTenantFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => insertTenantSchema.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* TenantRepo;
        const created = yield* repo.create(data);
        return selectTenantSchema.parse(created);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({
          Forbidden: forbidden,
          TenantNameConflict: conflict,
          TenantDatabaseError: dbError,
        }),
      ),
    ),
  );

export const updateTenantFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UpdateTenantArgs.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* TenantRepo;
        const updated = yield* repo.update(data.id as TenantId, data.patch);
        return selectTenantSchema.parse(updated);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({
          TenantNotFound: notFound,
          Forbidden: forbidden,
          TenantNameConflict: conflict,
          TenantDatabaseError: dbError,
        }),
      ),
    ),
  );

export const softDeleteTenantFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TenantIdInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* TenantRepo;
        const row = yield* repo.softDelete(data.id as TenantId);
        return selectTenantSchema.parse(row);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({
          TenantNotFound: notFound,
          Forbidden: forbidden,
          TenantDatabaseError: dbError,
        }),
      ),
    ),
  );

export const restoreTenantFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TenantIdInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* TenantRepo;
        const row = yield* repo.restore(data.id as TenantId);
        return selectTenantSchema.parse(row);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({
          TenantNotFound: notFound,
          Forbidden: forbidden,
          TenantNameConflict: conflict,
          TenantDatabaseError: dbError,
        }),
      ),
    ),
  );

export const permanentDeleteTenantFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TenantIdInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* TenantRepo;
        yield* repo.permanentDelete(data.id as TenantId);
        return { ok: true as const };
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({
          TenantNotFound: notFound,
          Forbidden: forbidden,
          TenantNotDeleted: unprocessable,
          TenantInUse: conflict,
          TenantDatabaseError: dbError,
        }),
      ),
    ),
  );

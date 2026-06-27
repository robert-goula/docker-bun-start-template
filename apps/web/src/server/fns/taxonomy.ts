import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import * as z from "zod";
import { LOCALES } from "@/db/schema/pages";
import {
  insertTaxonomySchema,
  ListTaxonomiesInput,
  selectTaxonomySchema,
  taxonomyOptionGroupSchema,
  taxonomyOptionSchema,
  updateTaxonomySchema,
  type ListTaxonomiesPagedMeta,
  type PageSize,
  type TaxonomyId,
  type TaxonomyOption,
  type TaxonomyOptionGroup,
} from "@/db/schema/taxonomy";
import { authMiddleware } from "@/server/fns/auth";
import { runtime } from "@/server/runtime";
import { CurrentUser } from "@/server/services/CurrentUser";
import { TaxonomyRepo } from "@/server/services/TaxonomyRepo";

const TaxonomyIdInput = z.object({ id: z.uuid() });

// parentId null = roots; a uuid = that parent's children.
const ParentInput = z.object({ parentId: z.uuid().nullable().default(null) });
const OptionsInput = z.object({
  parentId: z.uuid().nullable().default(null),
  locale: z.enum(LOCALES),
});

const UpdateTaxonomyArgs = z.object({ id: z.uuid(), patch: updateTaxonomySchema });

const forbidden = () => Effect.fail(new Response("Forbidden", { status: 403 }));
const notFound = () => Effect.fail(new Response("Not Found", { status: 404 }));
const dbError = () => Effect.fail(new Response("Internal Server Error", { status: 500 }));

export const getTaxonomyByIdFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TaxonomyIdInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* TaxonomyRepo;
        const row = yield* repo.findById(data.id as TaxonomyId);
        return selectTaxonomySchema.parse(row);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({
          TaxonomyNotFound: notFound,
          Forbidden: forbidden,
          DatabaseError: dbError,
        }),
      ),
    ),
  );

// Admin builder read: full child rows of a parent (or roots when parentId is null).
export const listTaxonomyChildrenFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => ParentInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* TaxonomyRepo;
        const rows = yield* repo.listByParent(data.parentId as TaxonomyId | null);
        return rows.map((row) => selectTaxonomySchema.parse(row));
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({ Forbidden: forbidden, DatabaseError: dbError }),
      ),
    ),
  );

export const listTaxonomiesFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => ListTaxonomiesInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* TaxonomyRepo;
        const { rows, totalCount } = yield* repo.list(data);
        const pageCount = Math.ceil(totalCount / data.pageSize);
        const meta: ListTaxonomiesPagedMeta = {
          totalCount,
          pageCount,
          pageNumber: data.pageNumber,
          pageSize: data.pageSize as PageSize,
        };
        return { data: rows.map((row) => selectTaxonomySchema.parse(row)), meta };
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({ Forbidden: forbidden, DatabaseError: dbError }),
      ),
    ),
  );

// PUBLIC (no auth): the locale-resolved options of a parent, for server-rendering placed
// field controls on public pages. Never throws — errors resolve to an empty list so a single
// bad reference can't 500 a public page.
export const getTaxonomyOptionsFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => OptionsInput.parse(input))
  .handler(
    ({ data }): Promise<TaxonomyOption[]> =>
      runtime.runPromise(
        Effect.gen(function* () {
          const repo = yield* TaxonomyRepo;
          const options = yield* repo.listForRender(
            data.parentId as TaxonomyId | null,
            data.locale,
          );
          return z.array(taxonomyOptionSchema).parse(options);
        }).pipe(Effect.catchTags({ DatabaseError: () => Effect.succeed([]) })),
      ),
  );

// PUBLIC (no auth): the locale-resolved options of a parent, grouped one level deep — each
// direct child carries its own children. A child with children renders as an `<optgroup>`; a
// childless one as a plain option. Like `getTaxonomyOptionsFn`, never throws (errors → []).
export const getTaxonomyOptionGroupsFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => OptionsInput.parse(input))
  .handler(
    ({ data }): Promise<TaxonomyOptionGroup[]> =>
      runtime.runPromise(
        Effect.gen(function* () {
          const repo = yield* TaxonomyRepo;
          const groups = yield* repo.listForRenderGrouped(
            data.parentId as TaxonomyId | null,
            data.locale,
          );
          return z.array(taxonomyOptionGroupSchema).parse(groups);
        }).pipe(Effect.catchTags({ DatabaseError: () => Effect.succeed([]) })),
      ),
  );

export const createTaxonomyFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => insertTaxonomySchema.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* TaxonomyRepo;
        const created = yield* repo.create(data);
        return selectTaxonomySchema.parse(created);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({ Forbidden: forbidden, DatabaseError: dbError }),
      ),
    ),
  );

export const updateTaxonomyFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UpdateTaxonomyArgs.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* TaxonomyRepo;
        const updated = yield* repo.update(data.id as TaxonomyId, data.patch);
        return selectTaxonomySchema.parse(updated);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({
          TaxonomyNotFound: notFound,
          Forbidden: forbidden,
          DatabaseError: dbError,
        }),
      ),
    ),
  );

export const deleteTaxonomyFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TaxonomyIdInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* TaxonomyRepo;
        yield* repo.remove(data.id as TaxonomyId);
        return { ok: true } as const;
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({
          TaxonomyNotFound: notFound,
          Forbidden: forbidden,
          DatabaseError: dbError,
        }),
      ),
    ),
  );

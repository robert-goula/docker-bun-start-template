import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import * as z from "zod";
import { LOCALES } from "@/db/schema/pages";
import { contentSchemaForKind, widgetKinds } from "@/db/schema/widgets";
import { zoneSizes } from "@/db/schema/zones";
import { isSlugReachable, normalizeSlug } from "@/lib/locale";
import { authMiddleware } from "@/server/fns/auth";
import { runtime } from "@/server/runtime";
import { CurrentUser } from "@/server/services/CurrentUser";
import { PageRepo } from "@/server/services/PageRepo";
import { jsonSchema } from "@/types/Json";
import type { PageLayout } from "@/components/Zone";

const widgetSchema = z
  .object({
    id: z.string(),
    kind: z.enum(widgetKinds),
    options: z.record(z.string(), z.unknown()),
    content: jsonSchema.nullable().optional(),
  })
  // Content shape is per-kind (markdown: a string; others: an object/string), so
  // validate it against the kind's schema and surface issues under `content`.
  .superRefine((widget, ctx) => {
    const result = contentSchemaForKind(widget.kind).safeParse(widget.content ?? null);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({ ...issue, path: ["content", ...issue.path] });
      }
    }
  });

const zoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  size: z.enum(zoneSizes),
  order: z.number().int(),
  defaultOpen: z.boolean(),
  widgets: z.array(widgetSchema),
});

const pageLayoutSchema = z.object({ zones: z.array(zoneSchema) });

// Identifies which page to load: a route slug plus an optional locale (defaults
// server-side to DEFAULT_LOCALE). The title is derived from the slug on first
// creation (see PageRepo) and read from the DB thereafter.
const pageRefSchema = z.object({
  slug: z.string().min(1).max(255),
  locale: z.enum(LOCALES).optional(),
});
export type PageRefInput = z.infer<typeof pageRefSchema>;

const forbidden = () => Effect.fail(new Response("Forbidden", { status: 403 }));
const dbError = () => Effect.fail(new Response("Internal Server Error", { status: 500 }));
const conflict = (e: { message: string }) => Effect.fail(new Response(e.message, { status: 409 }));

// A user-entered slug, normalized to the storage convention and rejected if it would be
// unreachable (first segment is a locale code). Used when renaming a locale's slug.
const slugSchema = z
  .string()
  .max(255)
  .transform(normalizeSlug)
  .refine(isSlugReachable, { message: "slug may not start with a locale code" });

// One row in the admin pages listing: the page plus its layout name and the
// usernames of its creator/last editor (null when unknown).
const selectPageListItemSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  locale: z.enum(LOCALES),
  title: z.string(),
  layoutName: z.string(),
  created: z.coerce.date(),
  createdByName: z.string().nullable(),
  updated: z.coerce.date().nullable(),
  updatedByName: z.string().nullable(),
});
export type SafePageListItem = z.infer<typeof selectPageListItemSchema>;

export const listPagesFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* PageRepo;
        const rows = yield* repo.list;
        return rows.map((row) => selectPageListItemSchema.parse(row));
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({ Forbidden: forbidden, DatabaseError: dbError }),
      ),
    ),
  );

export const loadPageLayoutFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => pageRefSchema.parse(input))
  .handler(({ data }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* PageRepo;
        return yield* repo.getPageLayout(data);
      }).pipe(Effect.catchTags({ DatabaseError: dbError })),
    ),
  );

// Public, read-only page metadata for the dynamic CMS route: SEO title/description, the
// canonical slug, and the locales this slug exists in. Returns null for an unknown slug
// (the route turns that into notFound) — it never auto-creates.
export const resolvePageMetaFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => pageRefSchema.parse(input))
  .handler(({ data }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* PageRepo;
        return yield* repo.getPageMeta(data);
      }).pipe(Effect.catchTags({ DatabaseError: dbError })),
    ),
  );

// Admin authoring: create a new page (slug + locale) linked to the default layout.
const createPageInputSchema = z.object({
  slug: z.string().min(1).max(255),
  locale: z.enum(LOCALES),
  title: z.string().min(1).max(255).optional(),
});

export const createPageFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createPageInputSchema.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) => {
    if (!context.user.roles.includes("admin")) {
      throw new Response("Forbidden", { status: 403 });
    }
    return runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* PageRepo;
        yield* repo.createPage(data);
        return { ok: true } as const;
      }).pipe(Effect.catchTags({ DatabaseError: dbError })),
    );
  });

// Admin authoring: clone an existing page into a missing locale (shared slug).
const createTranslationInputSchema = z.object({
  slug: z.string().min(1).max(255),
  fromLocale: z.enum(LOCALES),
  toLocale: z.enum(LOCALES),
});

export const createPageTranslationFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createTranslationInputSchema.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) => {
    if (!context.user.roles.includes("admin")) {
      throw new Response("Forbidden", { status: 403 });
    }
    return runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* PageRepo;
        yield* repo.createTranslation(data.slug, data.fromLocale, data.toLocale);
        return { ok: true } as const;
      }).pipe(Effect.catchTags({ DatabaseError: dbError })),
    );
  });

// Admin authoring: update a page's metadata for a (slug, locale). `title`/`description`
// are the basic module's fields; `modules` carries extension modules (Open Graph, …),
// validated per-module against the registry server-side (PageRepo.updatePageMeta).
const metaScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const metaValueSchema = z.union([metaScalarSchema, z.array(metaScalarSchema)]);
const updatePageMetaInputSchema = z.object({
  ref: pageRefSchema,
  slug: slugSchema.optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(500).nullable().optional(),
  modules: z.record(z.string(), z.record(z.string(), metaValueSchema)).optional(),
});

export const updatePageMetaFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updatePageMetaInputSchema.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) => {
    if (!context.user.roles.includes("admin")) {
      throw new Response("Forbidden", { status: 403 });
    }
    return runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* PageRepo;
        yield* repo.updatePageMeta(data.ref, {
          slug: data.slug,
          title: data.title,
          description: data.description,
          modules: data.modules,
        });
        return { ok: true } as const;
      }).pipe(Effect.catchTags({ DatabaseError: dbError, ConflictError: conflict })),
    );
  });

// Saving is content-only: a page ref (which page) plus the layout carrying the
// widgets to persist. Zone arrangement is owned by the layout and ignored here.
const savePageInputSchema = z.object({ ref: pageRefSchema, layout: pageLayoutSchema });

export const savePageLayoutFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => savePageInputSchema.parse(input))
  .handler(({ data }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* PageRepo;
        yield* repo.savePageLayout(data.ref, data.layout as PageLayout);
        return { ok: true } as const;
      }).pipe(Effect.catchTags({ DatabaseError: dbError })),
    ),
  );

// Re-points a page at a different layout. Admin-only authoring action: changing the
// layout only swaps the zone arrangement, leaving the page's widget content in place.
const setPageLayoutInputSchema = z.object({ ref: pageRefSchema, layoutId: z.uuid() });

export const setPageLayoutFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => setPageLayoutInputSchema.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) => {
    if (!context.user.roles.includes("admin")) {
      throw new Response("Forbidden", { status: 403 });
    }
    return runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* PageRepo;
        yield* repo.setPageLayout(data.ref, data.layoutId);
        return { ok: true } as const;
      }).pipe(Effect.catchTags({ DatabaseError: dbError })),
    );
  });

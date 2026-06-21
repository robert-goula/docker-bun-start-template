import { asc, eq } from "drizzle-orm";
import { Data, Effect } from "effect";
import { Database, DatabaseLive } from "@/db/layer";
import {
  type CustomWidgetField,
  type CustomWidgetId,
  customWidgets,
} from "@/db/schema/customWidgets";
import { CurrentUser } from "./CurrentUser";
import { Policy } from "./Policy";

// Inputs accepted by the repo. `update` carries only the fields that changed.
export interface CreateCustomWidgetInput {
  name: string;
  description?: string | null;
}
export interface UpdateCustomWidgetInput {
  name?: string;
  slug?: string;
  template?: string | null;
  element?: string | null;
  description?: string | null;
  fields?: ReadonlyArray<CustomWidgetField>;
}

export class CustomWidgetNotFound extends Data.TaggedError("CustomWidgetNotFound")<{
  readonly id: CustomWidgetId;
}> {}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly cause: unknown;
}> {}

// Derives a url-safe slug from a name (e.g. "Hero Banner!" -> "hero-banner").
const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "widget";

export class CustomWidgetRepo extends Effect.Service<CustomWidgetRepo>()("app/CustomWidgetRepo", {
  effect: Effect.gen(function* () {
    const db = yield* Database;

    const list = Effect.gen(function* () {
      yield* Policy.canListCustomWidgets;
      return yield* Effect.tryPromise({
        try: () => db.query.customWidgets.findMany({ orderBy: asc(customWidgets.name) }),
        catch: (cause) => new DatabaseError({ cause }),
      });
    });

    const findById = (id: CustomWidgetId) =>
      Effect.gen(function* () {
        yield* Policy.canReadCustomWidget;
        const row = yield* Effect.tryPromise({
          try: () => db.query.customWidgets.findFirst({ where: eq(customWidgets.id, id) }),
          catch: (cause) => new DatabaseError({ cause }),
        });
        if (!row) return yield* Effect.fail(new CustomWidgetNotFound({ id }));
        return row;
      });

    // Render-scoped read: NO policy check. Definitions are needed to render instances on
    // public pages, so this is intentionally readable without auth. Callers must only ever
    // expose the public render projection (renderCustomWidgetSchema) from this — never the
    // full row — and must not use it for any management path.
    const findForRender = (id: CustomWidgetId) =>
      Effect.gen(function* () {
        const row = yield* Effect.tryPromise({
          try: () => db.query.customWidgets.findFirst({ where: eq(customWidgets.id, id) }),
          catch: (cause) => new DatabaseError({ cause }),
        });
        if (!row) return yield* Effect.fail(new CustomWidgetNotFound({ id }));
        return row;
      });

    // Creates a definition starting with no fields; the admin adds fields on the edit page.
    const create = (input: CreateCustomWidgetInput) =>
      Effect.gen(function* () {
        yield* Policy.canCreateCustomWidget;
        const currentUser = yield* CurrentUser;
        const id = yield* Effect.tryPromise({
          try: async () => {
            const rows = await db
              .insert(customWidgets)
              .values({
                name: input.name,
                slug: slugify(input.name),
                description: input.description ?? null,
                fields: [],
                createdBy: currentUser.id,
              })
              .returning({ id: customWidgets.id });
            const newId = rows[0]?.id;
            if (!newId) throw new Error("custom widget insert returned no rows");
            return newId;
          },
          catch: (cause) => new DatabaseError({ cause }),
        });
        return yield* findById(id as CustomWidgetId);
      });

    const update = (id: CustomWidgetId, patch: UpdateCustomWidgetInput) =>
      Effect.gen(function* () {
        yield* Policy.canUpdateCustomWidget;
        const currentUser = yield* CurrentUser;

        const exists = yield* Effect.tryPromise({
          try: () => db.query.customWidgets.findFirst({ where: eq(customWidgets.id, id) }),
          catch: (cause) => new DatabaseError({ cause }),
        });
        if (!exists) return yield* Effect.fail(new CustomWidgetNotFound({ id }));

        yield* Effect.tryPromise({
          try: () => {
            const set: Record<string, unknown> = { updatedBy: currentUser.id };
            if (patch.name !== undefined) set.name = patch.name;
            if (patch.slug !== undefined) set.slug = patch.slug;
            if (patch.template !== undefined) set.template = patch.template;
            if (patch.element !== undefined) set.element = patch.element;
            if (patch.description !== undefined) set.description = patch.description;
            if (patch.fields !== undefined) set.fields = patch.fields;
            return db.update(customWidgets).set(set).where(eq(customWidgets.id, id));
          },
          catch: (cause) => new DatabaseError({ cause }),
        });

        return yield* findById(id);
      });

    const remove = (id: CustomWidgetId) =>
      Effect.gen(function* () {
        yield* Policy.canDeleteCustomWidget;
        const exists = yield* Effect.tryPromise({
          try: () => db.query.customWidgets.findFirst({ where: eq(customWidgets.id, id) }),
          catch: (cause) => new DatabaseError({ cause }),
        });
        if (!exists) return yield* Effect.fail(new CustomWidgetNotFound({ id }));
        yield* Effect.tryPromise({
          try: () => db.delete(customWidgets).where(eq(customWidgets.id, id)),
          catch: (cause) => new DatabaseError({ cause }),
        });
        return { id } as const;
      });

    return { list, findById, findForRender, create, update, remove } as const;
  }),
  dependencies: [DatabaseLive],
}) {}

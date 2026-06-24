import { and, asc, eq, inArray } from "drizzle-orm";
import { Data, Effect } from "effect";
import { Database, DatabaseLive } from "@/db/layer";
import { type MenuId, type MenuItem, type MenuRender, menus } from "@/db/schema/menus";
import { DEFAULT_LOCALE, type Locale, pages } from "@/db/schema/pages";
import { indexPagesByGroup, resolveMenuItems } from "@/lib/menu";
import { CurrentUser } from "./CurrentUser";
import { Policy } from "./Policy";

// Inputs accepted by the repo. `update` carries only the fields that changed.
export interface CreateMenuInput {
  name: string;
  description?: string | null;
}
export interface UpdateMenuInput {
  name?: string;
  slug?: string;
  description?: string | null;
  items?: ReadonlyArray<MenuItem>;
}

export class MenuNotFound extends Data.TaggedError("MenuNotFound")<{
  readonly id: MenuId;
}> {}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly cause: unknown;
}> {}

// Derives a url-safe slug from a name (e.g. "Main Nav!" -> "main-nav").
const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "menu";

// Walks the tree collecting every page item's groupId (deduplicated).
const collectGroupIds = (items: ReadonlyArray<MenuItem>, out: Set<string> = new Set()) => {
  for (const item of items) {
    if (item.type === "page") out.add(item.groupId);
    collectGroupIds(item.children, out);
  }
  return out;
};

export class MenuRepo extends Effect.Service<MenuRepo>()("app/MenuRepo", {
  effect: Effect.gen(function* () {
    const db = yield* Database;

    const list = Effect.gen(function* () {
      yield* Policy.canListMenus;
      return yield* Effect.tryPromise({
        try: () => db.query.menus.findMany({ orderBy: asc(menus.name) }),
        catch: (cause) => new DatabaseError({ cause }),
      });
    });

    const findById = (id: MenuId) =>
      Effect.gen(function* () {
        yield* Policy.canReadMenu;
        const row = yield* Effect.tryPromise({
          try: () => db.query.menus.findFirst({ where: eq(menus.id, id) }),
          catch: (cause) => new DatabaseError({ cause }),
        });
        if (!row) return yield* Effect.fail(new MenuNotFound({ id }));
        return row;
      });

    // Render-scoped read: NO policy check. Menus are needed to render placed widgets on
    // public pages, so this is intentionally readable without auth. Returns the PUBLIC
    // render projection only (resolved links, no groupIds / authoring metadata).
    //
    // The tree is baked for one locale: every page item is resolved to that locale's slug
    // (buildHref) + title via the shared groupId, falling back to the default-locale row
    // when a translation is missing. A page whose group no longer resolves (deleted) is
    // dropped so one stale reference can't break the menu.
    const findForRender = (id: MenuId, locale: Locale) =>
      Effect.gen(function* () {
        const row = yield* Effect.tryPromise({
          try: () => db.query.menus.findFirst({ where: eq(menus.id, id) }),
          catch: (cause) => new DatabaseError({ cause }),
        });
        if (!row) return yield* Effect.fail(new MenuNotFound({ id }));

        const groupIds = [...collectGroupIds(row.items)];
        const pageRows =
          groupIds.length === 0
            ? []
            : yield* Effect.tryPromise({
                try: () =>
                  db
                    .select({
                      groupId: pages.groupId,
                      slug: pages.slug,
                      title: pages.title,
                      locale: pages.locale,
                    })
                    .from(pages)
                    .where(
                      and(
                        inArray(pages.groupId, groupIds),
                        inArray(pages.locale, [locale, DEFAULT_LOCALE]),
                      ),
                    ),
                catch: (cause) => new DatabaseError({ cause }),
              });

        // groupId -> { slug, title } in the requested locale, preferring it over the
        // default-locale fallback when both rows are present.
        const byGroup = indexPagesByGroup(pageRows, locale);

        return {
          id: row.id,
          name: row.name,
          slug: row.slug,
          items: resolveMenuItems(row.items, locale, (groupId) => byGroup.get(groupId)),
        } satisfies MenuRender;
      });

    // Creates a menu starting empty; the admin builds the tree on the edit page.
    const create = (input: CreateMenuInput) =>
      Effect.gen(function* () {
        yield* Policy.canCreateMenu;
        const currentUser = yield* CurrentUser;
        const id = yield* Effect.tryPromise({
          try: async () => {
            const rows = await db
              .insert(menus)
              .values({
                name: input.name,
                slug: slugify(input.name),
                description: input.description ?? null,
                items: [],
                createdBy: currentUser.id,
              })
              .returning({ id: menus.id });
            const newId = rows[0]?.id;
            if (!newId) throw new Error("menu insert returned no rows");
            return newId;
          },
          catch: (cause) => new DatabaseError({ cause }),
        });
        return yield* findById(id as MenuId);
      });

    const update = (id: MenuId, patch: UpdateMenuInput) =>
      Effect.gen(function* () {
        yield* Policy.canUpdateMenu;
        const currentUser = yield* CurrentUser;

        const exists = yield* Effect.tryPromise({
          try: () => db.query.menus.findFirst({ where: eq(menus.id, id) }),
          catch: (cause) => new DatabaseError({ cause }),
        });
        if (!exists) return yield* Effect.fail(new MenuNotFound({ id }));

        yield* Effect.tryPromise({
          try: () => {
            const set: Record<string, unknown> = { updatedBy: currentUser.id };
            if (patch.name !== undefined) set.name = patch.name;
            if (patch.slug !== undefined) set.slug = patch.slug;
            if (patch.description !== undefined) set.description = patch.description;
            if (patch.items !== undefined) set.items = patch.items;
            return db.update(menus).set(set).where(eq(menus.id, id));
          },
          catch: (cause) => new DatabaseError({ cause }),
        });

        return yield* findById(id);
      });

    const remove = (id: MenuId) =>
      Effect.gen(function* () {
        yield* Policy.canDeleteMenu;
        const exists = yield* Effect.tryPromise({
          try: () => db.query.menus.findFirst({ where: eq(menus.id, id) }),
          catch: (cause) => new DatabaseError({ cause }),
        });
        if (!exists) return yield* Effect.fail(new MenuNotFound({ id }));
        yield* Effect.tryPromise({
          try: () => db.delete(menus).where(eq(menus.id, id)),
          catch: (cause) => new DatabaseError({ cause }),
        });
        return { id } as const;
      });

    return { list, findById, findForRender, create, update, remove } as const;
  }),
  dependencies: [DatabaseLive],
}) {}

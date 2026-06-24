import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { jsonb } from "../jsonb";

const MenuIdSchema = z.uuidv7().brand<"MenuId">();
export type MenuId = z.infer<typeof MenuIdSchema>;

// How deep a menu tree may nest. Bounds render work and keeps the builder usable;
// enforced by menuItemsSchema (a deeper tree is rejected at save time).
export const MENU_MAX_DEPTH = 3;

/**
 * A single menu item. A tagged union on `type`:
 * - `page`     — links to a page by its canonical `groupId` (shared across locale
 *                translations). Resolved per-locale at render to that locale's slug +
 *                title, so one menu auto-translates. `label` overrides the page title.
 * - `external` — a literal href (absolute or site-relative); always carries a `label`.
 * - `heading`  — a non-link grouping parent; renders its `label` and `children` only.
 *
 * Every node carries a client-generated `id` (builder keys / sortable; never resolved
 * to anything) and a `children` array (recursive). A future `dynamic` member (computed
 * slugs) slots in here with no change elsewhere but the resolver switch.
 */
export type MenuItem =
  | { id: string; type: "page"; groupId: string; label?: string; children: MenuItem[] }
  | {
      id: string;
      type: "external";
      href: string;
      label: string;
      newTab?: boolean;
      children: MenuItem[];
    }
  | { id: string; type: "heading"; label: string; children: MenuItem[] };

// Recursive via z.lazy + an explicit return type. The discriminated union narrows each
// variant by `type`, which the builder and resolver rely on.
export const menuItemSchema: z.ZodType<MenuItem> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      id: z.string().min(1),
      type: z.literal("page"),
      groupId: z.uuid(),
      label: z.string().max(120).optional(),
      children: z.array(menuItemSchema),
    }),
    z.object({
      id: z.string().min(1),
      type: z.literal("external"),
      href: z.string().min(1).max(2000),
      label: z.string().min(1).max(120),
      newTab: z.boolean().optional(),
      children: z.array(menuItemSchema),
    }),
    z.object({
      id: z.string().min(1),
      type: z.literal("heading"),
      label: z.string().min(1).max(120),
      children: z.array(menuItemSchema),
    }),
  ]),
);

// Returns the maximum depth of a tree (1 for a flat list), 0 for empty.
const treeDepth = (items: ReadonlyArray<MenuItem>): number =>
  items.length === 0 ? 0 : 1 + Math.max(...items.map((i) => treeDepth(i.children)));

// The ordered tree stored in the `items` jsonb column. Capped at MENU_MAX_DEPTH so a
// pathological tree can't be persisted (and so render stays bounded).
export const menuItemsSchema = z.array(menuItemSchema).superRefine((items, ctx) => {
  if (treeDepth(items) > MENU_MAX_DEPTH) {
    ctx.addIssue({
      code: "custom",
      message: `Menus may nest at most ${MENU_MAX_DEPTH} levels deep`,
    });
  }
});

// A reusable, hierarchical menu. Editors build the tree in the admin menu builder and
// render it anywhere via the "menu" widget (bound by id).
export const menus = pgTable(
  "menu",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    // Human label shown in the picker and admin (e.g. "Main navigation").
    name: varchar({ length: 80 }).notNull(),
    // Stable machine key, slugified from the name.
    slug: varchar({ length: 80 }).notNull(),
    description: varchar({ length: 500 }),
    items: jsonb<MenuItem[]>("items").notNull().default([]),
    created: timestamp({ precision: 3, withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid(),
    updated: timestamp({ precision: 3, withTimezone: true }).$onUpdate(() => sql`now()`),
    updatedBy: uuid(),
  },
  (t) => ({
    menu_name_idx: unique("menu_name_idx").on(t.name),
    menu_slug_idx: unique("menu_slug_idx").on(t.slug),
  }),
);

export type CreateMenu = InferInsertModel<typeof menus>;
export type Menu = InferSelectModel<typeof menus>;
export type Menus = ReadonlyArray<Menu>;

const insertMenuBaseSchema = createInsertSchema(menus).omit({
  id: true,
  created: true,
  createdBy: true,
  updated: true,
  updatedBy: true,
});

export const insertMenuSchema = insertMenuBaseSchema.extend({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(80),
  description: z.string().max(500).nullable().optional(),
  items: menuItemsSchema.default([]),
});
export type InsertMenuInput = z.infer<typeof insertMenuSchema>;

export const selectMenuSchema = createSelectSchema(menus).extend({
  items: menuItemsSchema,
  created: z.coerce.date(),
  updated: z.coerce.date().nullable(),
});

export const updateMenuSchema = z
  .object({
    name: z.string().min(1).max(80),
    slug: z.string().min(1).max(80),
    description: z.string().max(500).nullable(),
    items: menuItemsSchema,
  })
  .partial();
export type UpdateMenuInput = z.infer<typeof updateMenuSchema>;

/**
 * A menu resolved for one locale: the tree baked into plain links. `page` items become
 * `{ href, label }` (the locale's slug via buildHref + its title, override winning);
 * `external` items keep their href/label/newTab; `heading` items have no href. This is
 * the PUBLIC, render-only projection (no groupIds, no authoring metadata) sent to the
 * "menu" widget, mirroring the custom-widget render projection.
 */
export interface MenuLink {
  id: string;
  label: string;
  href?: string;
  newTab?: boolean;
  children: MenuLink[];
}

export interface MenuRender {
  id: string;
  name: string;
  slug: string;
  items: MenuLink[];
}

export const menuLinkSchema: z.ZodType<MenuLink> = z.lazy(() =>
  z.object({
    id: z.string(),
    label: z.string(),
    href: z.string().optional(),
    newTab: z.boolean().optional(),
    children: z.array(menuLinkSchema),
  }),
);

export const menuRenderSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  items: z.array(menuLinkSchema),
});

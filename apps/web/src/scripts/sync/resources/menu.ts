import { and, asc, eq, ne, or } from "drizzle-orm";
import * as z from "zod";
import {
  MENU_ORIENTATIONS,
  MENU_SUBMENU_MODES,
  menuItemsSchema,
  menus,
} from "@/db/schema/menus";
import { envelope, type SyncResource, SYNC_VERSION } from "../types";

const bodySchema = z.object({
  kind: z.literal("menu"),
  version: z.literal(SYNC_VERSION),
  id: z.uuid(),
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(80),
  description: z.string().max(500).nullish(),
  orientation: z.enum(MENU_ORIENTATIONS),
  submenuMode: z.enum(MENU_SUBMENU_MODES),
  items: menuItemsSchema,
});

// Reusable hierarchical menus (`@/db/schema/menus`). Keyed by uuid `id` (kept stable so the
// `menu` widget's `options.menuId` references survive); filename keyed by the unique slug.
export const menuResource: SyncResource = {
  kind: "menu",
  order: 3,
  async collect(db, key) {
    const rows = await db.query.menus.findMany({
      where: key ? or(eq(menus.slug, key), eq(menus.name, key)) : undefined,
      orderBy: asc(menus.name),
    });
    return rows.map((row) => ({
      key: row.slug,
      body: envelope("menu", {
        id: row.id,
        name: row.name,
        slug: row.slug,
        ...(row.description ? { description: row.description } : {}),
        orientation: row.orientation,
        submenuMode: row.submenuMode,
        items: row.items,
      }),
    }));
  },
  async apply(db, raw) {
    const doc = bodySchema.parse(raw);
    const values = {
      id: doc.id,
      name: doc.name,
      slug: doc.slug,
      description: doc.description ?? null,
      orientation: doc.orientation,
      submenuMode: doc.submenuMode,
      items: doc.items,
    };
    await db.transaction(async (tx) => {
      // Committed file wins: a different local menu squatting on this slug is removed so the
      // unique slug index won't block the upsert below.
      await tx.delete(menus).where(and(eq(menus.slug, doc.slug), ne(menus.id, doc.id)));
      await tx.insert(menus).values(values).onConflictDoUpdate({ target: menus.id, set: values });
    });
  },
};

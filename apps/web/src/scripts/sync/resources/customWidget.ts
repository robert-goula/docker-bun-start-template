import { and, asc, eq, ne, or } from "drizzle-orm";
import * as z from "zod";
import { customWidgetFieldsSchema, customWidgets } from "@/db/schema/customWidgets";
import { widgetElements } from "@/db/schema/widgets";
import { envelope, type SyncResource, SYNC_VERSION } from "../types";

const bodySchema = z.object({
  kind: z.literal("custom-widget"),
  version: z.literal(SYNC_VERSION),
  id: z.uuid(),
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(80),
  template: z.string().max(40).nullish(),
  element: z.enum(widgetElements).nullish(),
  description: z.string().max(500).nullish(),
  fields: customWidgetFieldsSchema,
});

// Reusable data-authored widget definitions (`@/db/schema/customWidgets`, table custom_widget).
// `fields[].taxonomyId` softly references a taxonomy parent, so this imports AFTER taxonomy.
// Keyed by uuid `id` (so "dynamic" instances bound by id survive); filename keyed by slug.
export const customWidgetResource: SyncResource = {
  kind: "custom-widget",
  order: 2,
  async collect(db, key) {
    const rows = await db.query.customWidgets.findMany({
      where: key ? or(eq(customWidgets.slug, key), eq(customWidgets.name, key)) : undefined,
      orderBy: asc(customWidgets.name),
    });
    return rows.map((row) => ({
      key: row.slug,
      body: envelope("custom-widget", {
        id: row.id,
        name: row.name,
        slug: row.slug,
        ...(row.template ? { template: row.template } : {}),
        ...(row.element ? { element: row.element } : {}),
        ...(row.description ? { description: row.description } : {}),
        fields: row.fields,
      }),
    }));
  },
  async apply(db, raw) {
    const doc = bodySchema.parse(raw);
    const values = {
      id: doc.id,
      name: doc.name,
      slug: doc.slug,
      template: doc.template ?? null,
      element: doc.element ?? null,
      description: doc.description ?? null,
      fields: doc.fields,
    };
    await db.transaction(async (tx) => {
      // Committed file wins: remove a different local definition holding this slug.
      await tx
        .delete(customWidgets)
        .where(and(eq(customWidgets.slug, doc.slug), ne(customWidgets.id, doc.id)));
      await tx
        .insert(customWidgets)
        .values(values)
        .onConflictDoUpdate({ target: customWidgets.id, set: values });
    });
  },
};

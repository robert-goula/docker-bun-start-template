import { and, asc, eq, notInArray } from "drizzle-orm";
import * as z from "zod";
import { layouts } from "@/db/schema/layouts";
import { DEFAULT_LOCALE, LOCALES, pages } from "@/db/schema/pages";
import type { PageMetaData } from "@/lib/meta/types";
import { widgetKinds, widgets } from "@/db/schema/widgets";
import { type ZoneName, ZONE_NAMES, zones } from "@/db/schema/zones";
import { jsonSchema } from "@/types/Json";
import { envelope, slugify, type SyncResource, SYNC_VERSION } from "../types";

// One file per page-group: a "page" is several `page` rows (one per locale) that share a
// `groupId`, each with its own slug. They're nested under `locales[]` so all translations of
// a page live together, keyed on disk by the default-locale slug. Layout and zones are
// referenced by NAME so the file is portable; ids are resolved on import. The other soft
// refs (dynamic widget `options.definitionId`, menu widget `options.nId`) are uuids whose
// resources keep their ids across import, so they survive verbatim with no mapping — that's
// why `page` imports last (order 5, after layout/menu/custom-widget).
const widgetSchema = z.object({
  zone: z.enum(ZONE_NAMES),
  kind: z.enum(widgetKinds),
  order: z.number().int(),
  options: z.record(z.string(), z.unknown()).default({}),
  content: jsonSchema.nullish(),
});

const bodySchema = z.object({
  kind: z.literal("page"),
  version: z.literal(SYNC_VERSION),
  groupId: z.uuid(),
  system: z.boolean(),
  layout: z.string().min(1).max(80),
  locales: z
    .array(
      z.object({
        locale: z.enum(LOCALES),
        slug: z.string().min(1).max(255),
        title: z.string().min(1).max(255),
        description: z.string().max(500).nullish(),
        meta: z.record(z.string(), z.unknown()).default({}),
        hiddenLayoutWidgets: z.array(z.string()).default([]),
        widgets: z.array(widgetSchema).default([]),
      }),
    )
    .min(1),
});

export const pageResource: SyncResource = {
  kind: "page",
  order: 5,
  async collect(db, key) {
    const rows = await db
      .select({
        id: pages.id,
        slug: pages.slug,
        locale: pages.locale,
        groupId: pages.groupId,
        system: pages.system,
        title: pages.title,
        description: pages.description,
        meta: pages.meta,
        hiddenLayoutWidgets: pages.hiddenLayoutWidgets,
        layout: layouts.name,
      })
      .from(pages)
      .innerJoin(layouts, eq(layouts.id, pages.layoutId))
      .orderBy(asc(pages.groupId), asc(pages.locale));

    // Bucket locale rows by groupId, preserving locale order.
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const bucket = groups.get(row.groupId) ?? [];
      bucket.push(row);
      groups.set(row.groupId, bucket);
    }

    const out = [];
    for (const localeRows of groups.values()) {
      // Filename identity + portable layout come from the default-locale row (fallback: first).
      const head = localeRows.find((r) => r.locale === DEFAULT_LOCALE) ?? localeRows[0];
      const docKey = slugify(head.slug);
      if (key && docKey !== key) continue;

      const localeDocs = [];
      for (const row of localeRows) {
        const widgetRows = await db
          .select({
            zone: zones.name,
            kind: widgets.kind,
            order: widgets.order,
            options: widgets.options,
            content: widgets.content,
          })
          .from(widgets)
          .innerJoin(zones, eq(zones.id, widgets.zoneId))
          .where(eq(widgets.pageId, row.id))
          .orderBy(asc(zones.name), asc(widgets.order));
        localeDocs.push({
          locale: row.locale,
          slug: row.slug,
          title: row.title,
          ...(row.description ? { description: row.description } : {}),
          meta: row.meta,
          hiddenLayoutWidgets: row.hiddenLayoutWidgets,
          widgets: widgetRows.map((w) => ({
            zone: w.zone,
            kind: w.kind,
            order: w.order,
            options: w.options,
            ...(w.content == null ? {} : { content: w.content }),
          })),
        });
      }

      out.push({
        key: docKey,
        body: envelope("page", {
          groupId: head.groupId,
          system: head.system,
          layout: head.layout,
          locales: localeDocs,
        }),
      });
    }
    return out;
  },
  async apply(db, raw) {
    const doc = bodySchema.parse(raw);

    const layout = await db.query.layouts.findFirst({ where: eq(layouts.name, doc.layout) });
    if (!layout) throw new Error(`page ${doc.locales[0].slug}: unknown layout "${doc.layout}"`);

    const zoneCatalog = await db.select({ id: zones.id, name: zones.name }).from(zones);
    const zoneIdByName = new Map<ZoneName, string>(
      zoneCatalog.map((row) => [row.name as ZoneName, row.id]),
    );

    await db.transaction(async (tx) => {
      const keptIds: string[] = [];
      for (const loc of doc.locales) {
        const values = {
          slug: loc.slug,
          locale: loc.locale,
          groupId: doc.groupId,
          system: doc.system,
          title: loc.title,
          description: loc.description ?? null,
          meta: loc.meta as PageMetaData,
          hiddenLayoutWidgets: loc.hiddenLayoutWidgets,
          layoutId: layout.id,
        };
        // Upsert on the (slug, locale) unique index: the committed file owns this slot, so an
        // existing row (this group's or another's) is folded into this group, keeping its id.
        const [page] = await tx
          .insert(pages)
          .values(values)
          .onConflictDoUpdate({ target: [pages.slug, pages.locale], set: values })
          .returning({ id: pages.id });
        keptIds.push(page.id);

        // The file is the source of truth for this page's widgets: replace them wholesale.
        await tx.delete(widgets).where(eq(widgets.pageId, page.id));
        if (loc.widgets.length > 0) {
          await tx.insert(widgets).values(
            loc.widgets.map((w) => {
              const zoneId = zoneIdByName.get(w.zone);
              if (!zoneId) throw new Error(`page ${loc.slug}: unknown zone "${w.zone}"`);
              return {
                pageId: page.id,
                zoneId,
                kind: w.kind,
                order: w.order,
                options: w.options,
                content: w.content ?? null,
              };
            }),
          );
        }
      }

      // Drop locale rows that this group used to have but the file no longer lists (e.g. a
      // removed translation or a renamed slug). Scoped to this groupId; widgets cascade.
      await tx
        .delete(pages)
        .where(and(eq(pages.groupId, doc.groupId), notInArray(pages.id, keptIds)));
    });
  },
};

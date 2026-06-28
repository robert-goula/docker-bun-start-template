import { eq } from "drizzle-orm";
import * as z from "zod";
import { type Taxonomy, type TaxonomyLocales, taxonomies } from "@/db/schema/taxonomy";
import { type Json, jsonSchema } from "@/types/Json";
import { envelope, slugify, type SyncDoc, type SyncResource, SYNC_VERSION } from "../types";

// A taxonomy node mirrored on disk: its own fields plus its ordered children (recursive).
interface TaxNode {
  id: string;
  value: string;
  locales: Record<string, string>;
  meta: Json;
  sort: number;
  children: TaxNode[];
}

const nodeSchema: z.ZodType<TaxNode> = z.lazy(() =>
  z.object({
    id: z.uuid(),
    value: z.string().min(1).max(255),
    locales: z.record(z.string(), z.string().max(255)),
    meta: jsonSchema,
    sort: z.number().int(),
    children: z.array(nodeSchema),
  }),
);

// The root node IS the file body, with the kind/version envelope folded in.
const bodySchema = nodeSchema.and(
  z.object({ kind: z.literal("taxonomy"), version: z.literal(SYNC_VERSION) }),
);

// Self-referencing tree of lookup terms (`@/db/schema/taxonomy`). `value` is immutable but not
// DB-unique, so uuid `id` is the only safe key (preserving it keeps soft refs like
// customWidget.fields[].taxonomyId valid). One file per ROOT tree, named by the root's value.
export const taxonomyResource: SyncResource = {
  kind: "taxonomy",
  order: 1,
  async collect(db, key) {
    const rows = await db.query.taxonomies.findMany();
    const childrenOf = new Map<string | null, Taxonomy[]>();
    for (const row of rows) {
      const list = childrenOf.get(row.parentId) ?? [];
      list.push(row);
      childrenOf.set(row.parentId, list);
    }
    const build = (row: Taxonomy): TaxNode => ({
      id: row.id,
      value: row.value,
      locales: row.locales,
      meta: row.meta,
      sort: row.sort,
      children: (childrenOf.get(row.id) ?? [])
        .sort((a, b) => a.sort - b.sort || a.value.localeCompare(b.value))
        .map(build),
    });

    const roots = (childrenOf.get(null) ?? []).sort(
      (a, b) => a.sort - b.sort || a.value.localeCompare(b.value),
    );
    const used = new Set<string>();
    const docs: SyncDoc[] = [];
    for (const root of roots) {
      let fileKey = slugify(root.value);
      // Roots aren't guaranteed unique by value; disambiguate so one doesn't overwrite another.
      if (used.has(fileKey)) fileKey = `${fileKey}-${root.id.slice(0, 8)}`;
      if (key && fileKey !== key && root.value !== key) continue;
      used.add(fileKey);
      docs.push({
        key: fileKey,
        body: envelope("taxonomy", build(root) as unknown as Record<string, unknown>),
      });
    }
    return docs;
  },
  async apply(db, raw) {
    const doc = bodySchema.parse(raw);
    await db.transaction(async (tx) => {
      // The file is the source of truth for this whole tree: drop the root (cascading the old
      // subtree) and re-insert from the file, preserving ids so soft references survive.
      await tx.delete(taxonomies).where(eq(taxonomies.id, doc.id));
      const insertNode = async (node: TaxNode, parentId: string | null): Promise<void> => {
        await tx.insert(taxonomies).values({
          id: node.id,
          parentId,
          value: node.value,
          locales: node.locales as TaxonomyLocales,
          meta: node.meta,
          sort: node.sort,
        });
        for (const child of node.children) await insertNode(child, node.id);
      };
      await insertNode(doc, null);
    });
  },
};

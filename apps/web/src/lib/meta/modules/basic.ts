import * as z from "zod";
import type { HeadMetaTag, MetaModule } from "../types";

/**
 * Basic SEO: the page `<title>` and meta description. These two fields are the special
 * case — they persist to the page's `title`/`description` columns (load-bearing in the
 * admin listing), not the `meta` jsonb. PageRepo injects them into the module map under
 * this id at read time so head rendering stays uniform across modules.
 */
export const basicSchema = z.object({
  title: z.string().max(255),
  description: z.string().max(500).nullish(),
});
export type BasicMeta = z.infer<typeof basicSchema>;

export const basicModule: MetaModule<BasicMeta> = {
  id: "basic",
  label: "Basic SEO",
  schema: basicSchema,
  defaults: { title: "", description: null },
  toHead: (data) => {
    const meta: HeadMetaTag[] = [{ title: data.title }];
    if (data.description) meta.push({ name: "description", content: data.description });
    return { meta };
  },
};

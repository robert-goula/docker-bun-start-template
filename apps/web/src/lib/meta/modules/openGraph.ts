import * as z from "zod";
import type { MetaModule } from "../types";

/**
 * Open Graph (https://ogp.me) — the worked example of an extension module. It stores its
 * data under `meta.openGraph` in the page's jsonb column and emits `og:*` property tags.
 * Adding Twitter cards / Dublin Core later follows this exact shape: a schema, defaults,
 * and a `toHead`, then a one-line registration in ../registry plus an editor.
 */
export const openGraphSchema = z.object({
  title: z.string().max(200).default(""),
  description: z.string().max(500).default(""),
  type: z.string().max(50).default("website"),
  // Image URL. Kept a plain string (not z.url()) so partial input while typing isn't
  // rejected — which would drop the whole module's data on save.
  image: z.string().max(2000).default(""),
});
export type OpenGraphMeta = z.infer<typeof openGraphSchema>;

export const openGraphModule: MetaModule<OpenGraphMeta> = {
  id: "openGraph",
  label: "Open Graph",
  schema: openGraphSchema,
  defaults: { title: "", description: "", type: "website", image: "" },
  toHead: (data) => {
    const meta: Array<Record<string, string>> = [];
    if (data.title) meta.push({ property: "og:title", content: data.title });
    if (data.description) meta.push({ property: "og:description", content: data.description });
    if (data.type) meta.push({ property: "og:type", content: data.type });
    if (data.image) meta.push({ property: "og:image", content: data.image });
    return { meta };
  },
};

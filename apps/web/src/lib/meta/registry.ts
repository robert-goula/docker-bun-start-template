import { basicModule } from "./modules/basic";
import { openGraphModule } from "./modules/openGraph";
import type { AnyMetaModule, MetaContext, MetaValue, ModuleHead, PageMetaData } from "./types";

/**
 * The registered metadata modules, in head/editor render order. The **basic** module must
 * stay first (it owns the page `<title>`). Add a module by importing it and appending here.
 */
export const metaModuleList: readonly AnyMetaModule[] = [
  basicModule,
  openGraphModule,
] as unknown as AnyMetaModule[];

const byId = new Map(metaModuleList.map((m) => [m.id, m] as const));

/** Look up a module definition by id. */
export const getMetaModule = (id: string): AnyMetaModule | undefined => byId.get(id);

/** Empty data for a module (its `defaults`), or `{}` for an unknown id. */
export const defaultsForModule = (id: string): Record<string, MetaValue> =>
  (byId.get(id)?.defaults ?? {}) as Record<string, MetaValue>;

/**
 * Composes every registered module's `<head>` contribution for a page. `modules` is the
 * effective per-module data map (the `meta` jsonb plus the basic module injected from the
 * page columns — see PageRepo.getPageMeta). Each module's data is normalized over its
 * defaults and validated; invalid or absent module data is skipped, never thrown.
 */
export function headTagsForPage(modules: PageMetaData, ctx: MetaContext): Required<ModuleHead> {
  const meta: Record<string, string>[] = [];
  const links: Record<string, string>[] = [];
  for (const mod of metaModuleList) {
    const raw = modules[mod.id];
    if (!raw) continue;
    const parsed = mod.schema.safeParse({ ...mod.defaults, ...raw });
    if (!parsed.success) continue;
    const out = mod.toHead(parsed.data, ctx);
    if (out.meta) meta.push(...out.meta);
    if (out.links) links.push(...out.links);
  }
  return { meta, links };
}

/**
 * Validates incoming module data for persistence: drops unknown module ids and the basic
 * module (its fields are columns, written separately), and normalizes each known module's
 * data over its defaults. Returns only what belongs in the `meta` jsonb column.
 */
export function sanitizeModules(input: PageMetaData): PageMetaData {
  const out: PageMetaData = {};
  for (const [id, data] of Object.entries(input)) {
    const mod = byId.get(id);
    if (!mod || mod.id === "basic") continue;
    const parsed = mod.schema.safeParse({ ...mod.defaults, ...data });
    if (parsed.success) out[id] = parsed.data as Record<string, MetaValue>;
  }
  return out;
}

import type * as z from "zod";
import type { Locale } from "@/db/schema/pages";

/**
 * Page metadata is composed of independent **modules** (basic SEO, Open Graph, Twitter
 * cards, Dublin Core, …). Each module owns a set of fields, knows how to render them into
 * the document `<head>`, and (separately) supplies an editor — mirroring the widget
 * registry split between an isomorphic definition and a lazy, edit-only component.
 *
 * Adding a module is purely additive: define it here + register it (see ./registry) and,
 * for editing, register a fields component (see components/meta/metaEditorRegistry). No
 * schema migration, route, or change to the head/save pipelines is required.
 */

/** A single `<head>` meta entry — attributes mirror TanStack Start's `head().meta`. */
export type HeadMetaTag = Record<string, string>;
/** A single `<head>` link entry (e.g. canonical, alternate). */
export type HeadLinkTag = Record<string, string>;

/** What a module contributes to the document head. */
export interface ModuleHead {
  meta?: HeadMetaTag[];
  links?: HeadLinkTag[];
}

/** Resolved request context handed to every module when emitting head tags. */
export interface MetaContext {
  readonly ref: { slug: string; locale: Locale };
  /** Canonical slug for the page (already canonical under the shared-slug model). */
  readonly slug: string;
  readonly locale: Locale;
}

/**
 * An isomorphic metadata module definition. Runs server-side in the page loader (via
 * registry.headTagsForPage) and is also the source of truth for validation, so it must
 * stay free of React / browser-only imports — the editor lives separately.
 */
export interface MetaModule<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Stable id; also the key under which non-basic modules persist in the `meta` jsonb. */
  readonly id: string;
  /** Human label shown in the editor. */
  readonly label: string;
  /** Validates + normalizes this module's stored data (apply over `defaults`). */
  readonly schema: z.ZodType<T>;
  /** Empty value used when the page has no data for this module yet. */
  readonly defaults: T;
  /** Emits this module's `<head>` tags from its (validated) data. */
  readonly toHead: (data: T, ctx: MetaContext) => ModuleHead;
}

/** A module with its field type erased — what the registry stores and iterates. */
export type AnyMetaModule = MetaModule<Record<string, unknown>>;

/**
 * A single metadata field value. Deliberately flat (scalar or scalar array) rather than
 * arbitrary JSON: metadata fields are simple, and a non-recursive type keeps the router's
 * loaderData inference from exceeding TypeScript's instantiation depth. It's also fully
 * serializable across the server-fn / loader boundary.
 */
export type MetaScalar = string | number | boolean | null;
export type MetaValue = MetaScalar | MetaScalar[];

/**
 * The page-level metadata blob persisted in the `page.meta` jsonb column: each module's
 * data keyed by module id. The **basic** module is the exception — its fields are the
 * page's `title`/`description` columns, injected into this map at read time (see PageRepo).
 */
export type PageMetaData = Record<string, Record<string, MetaValue>>;

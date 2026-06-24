import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/db/schema/pages";

// Re-export the canonical locale set so callers depend on one module. The list,
// default, and `Locale` type live with the DB schema (the `(slug, locale)` unique
// constraint is the storage-level source of truth); this module owns URL behavior.
export { DEFAULT_LOCALE, LOCALES, type Locale };

// A locale code is `language-country`, lowercase (e.g. "en-us"). Structural shape
// only — membership in LOCALES is what makes a segment an *enabled* locale.
export const LOCALE_RE = /^[a-z]{2}-[a-z]{2}$/;

/**
 * True only when `segment` both looks like a locale AND is enabled. This is the
 * guard that enforces the invariant **a slug may never equal an enabled locale
 * code**: any first path segment that passes here is treated as a locale prefix,
 * never as a slug, so authoring a page whose slug equals a locale (e.g. "/es-us")
 * would be unreachable. The CMS must reject such slugs (see db/schema/pages.ts).
 */
export function isLocale(segment: string): segment is Locale {
  return LOCALE_RE.test(segment) && (LOCALES as readonly string[]).includes(segment);
}

export type ResolvedLocale =
  | { locale: Locale; path: string; redirect?: undefined }
  | { redirect: string; locale?: undefined; path?: undefined };

/**
 * Request-scoped authority for "what locale is this URL, and what's the slug?".
 * Reads the pathname directly rather than trusting a structural route-param match.
 * - A redundant default-locale prefix is stripped via redirect ("/en-us/about" -> "/about").
 * - A valid non-default prefix yields { locale, path } with the locale peeled off.
 * - Anything else is the default locale; the whole pathname is the slug.
 * `path` follows the CMS slug convention: leading slash, home is "/".
 */
export function resolveLocale(pathname: string): ResolvedLocale {
  const [first, ...rest] = pathname.split("/").filter(Boolean);
  const toPath = (segments: string[]) => `/${segments.join("/")}`;
  if (first !== undefined && isLocale(first)) {
    if (first === DEFAULT_LOCALE) return { redirect: toPath(rest) };
    return { locale: first, path: toPath(rest) };
  }
  return { locale: DEFAULT_LOCALE, path: pathname === "" ? "/" : pathname };
}

/**
 * The single source for prefix rules: default locale is unprefixed ("/about"),
 * other locales are prefixed ("/es-us/about"). Reused by links, the language
 * switcher, hreflang alternates, and the admin pages list so the rule lives once.
 * `slug` follows the CMS convention (leading slash, home is "/").
 */
export function buildHref(locale: Locale, slug: string): string {
  const clean = slug.replace(/^\/+/, "").replace(/\/+$/, "");
  if (locale === DEFAULT_LOCALE) return clean ? `/${clean}` : "/";
  return clean ? `/${locale}/${clean}` : `/${locale}`;
}

/**
 * Normalizes a user-entered slug to the CMS storage convention: a single leading slash,
 * no trailing slash, collapsed internal slashes, lowercased; empty input is home ("/").
 * The locale prefix is never part of a stored slug (locale is a separate column), so a
 * leading locale segment is invalid input — see `isSlugReachable`.
 */
export function normalizeSlug(input: string): string {
  const clean = input
    .trim()
    .toLowerCase()
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  return clean === "" ? "/" : `/${clean}`;
}

/**
 * A normalized slug is reachable only if its first segment isn't an enabled locale code:
 * such a slug would be parsed as a locale prefix (see `isLocale`) and never resolve to a
 * page. Enforced when renaming a slug so the CMS can't author an unreachable URL.
 */
export function isSlugReachable(slug: string): boolean {
  const [first] = slug.split("/").filter(Boolean);
  return first === undefined || !isLocale(first);
}

/**
 * Maps our lowercase app locale to intlayer's canonical casing (en-us -> en-US)
 * for intlayer helpers like getHTMLTextDir / getLocaleName. Kept here as a pure
 * string transform so this module stays free of the intlayer runtime.
 */
export function intlayerLocale(locale: Locale): string {
  const [lang, country] = locale.split("-");
  return country ? `${lang}-${country.toUpperCase()}` : lang;
}

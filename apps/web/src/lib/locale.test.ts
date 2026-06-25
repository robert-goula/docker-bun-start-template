import { describe, expect, it } from "vitest";
import { buildHref, isLocale, isSlugReachable, normalizeSlug, resolveLocale } from "./locale";

describe("isLocale", () => {
  it("accepts enabled locale codes", () => {
    expect(isLocale("en-us")).toBe(true);
    expect(isLocale("es-us")).toBe(true);
  });

  it("rejects well-shaped but non-enabled codes (allowlist, not just regex)", () => {
    expect(isLocale("de-de")).toBe(false);
    expect(isLocale("xx-yy")).toBe(false);
  });

  it("rejects slugs that do not match the locale shape", () => {
    expect(isLocale("about")).toBe(false);
    expect(isLocale("en")).toBe(false);
    expect(isLocale("EN-US")).toBe(false);
  });
});

describe("resolveLocale", () => {
  it("treats an unprefixed path as the default locale, slug = full path", () => {
    expect(resolveLocale("/about")).toEqual({ locale: "en-us", path: "/about" });
  });

  it("keeps the home path as '/'", () => {
    expect(resolveLocale("/")).toEqual({ locale: "en-us", path: "/" });
  });

  it("peels a valid non-default prefix into { locale, path }", () => {
    expect(resolveLocale("/es-us/about")).toEqual({ locale: "es-us", path: "/about" });
    expect(resolveLocale("/es-us")).toEqual({ locale: "es-us", path: "/" });
  });

  it("redirects a redundant default-locale prefix to the bare path", () => {
    expect(resolveLocale("/en-us/about")).toEqual({ redirect: "/about" });
    expect(resolveLocale("/en-us")).toEqual({ redirect: "/" });
  });

  it("treats a non-locale first segment as a slug in the default locale", () => {
    expect(resolveLocale("/de-de/about")).toEqual({ locale: "en-us", path: "/de-de/about" });
  });
});

describe("buildHref", () => {
  it("omits the prefix for the default locale", () => {
    expect(buildHref("en-us", "/about")).toBe("/about");
    expect(buildHref("en-us", "/")).toBe("/");
  });

  it("prefixes non-default locales", () => {
    expect(buildHref("es-us", "/about")).toBe("/es-us/about");
    expect(buildHref("es-us", "/")).toBe("/es-us");
  });

  it("round-trips with resolveLocale", () => {
    for (const path of ["/about", "/", "/blog/post"]) {
      for (const locale of ["en-us", "es-us"] as const) {
        const href = buildHref(locale, path);
        const resolved = resolveLocale(href);
        expect(resolved.redirect).toBeUndefined();
        expect(resolved.locale).toBe(locale);
        expect(resolved.path).toBe(path);
      }
    }
  });
});

describe("normalizeSlug", () => {
  it("enforces a single leading slash, no trailing slash, lowercase", () => {
    expect(normalizeSlug("About")).toBe("/about");
    expect(normalizeSlug("/about/")).toBe("/about");
    expect(normalizeSlug("  blog/Post  ")).toBe("/blog/post");
    expect(normalizeSlug("//a//b//")).toBe("/a/b");
  });

  it("treats empty input as home", () => {
    expect(normalizeSlug("")).toBe("/");
    expect(normalizeSlug("   ")).toBe("/");
    expect(normalizeSlug("/")).toBe("/");
  });

  it("produces slugs that round-trip through buildHref + resolveLocale", () => {
    const slug = normalizeSlug("Acerca-De");
    expect(resolveLocale(buildHref("es-us", slug)).path).toBe(slug);
  });
});

describe("isSlugReachable", () => {
  it("rejects slugs whose first segment is a locale code", () => {
    expect(isSlugReachable(normalizeSlug("es-us"))).toBe(false);
    expect(isSlugReachable(normalizeSlug("es-us/about"))).toBe(false);
  });

  it("accepts ordinary slugs and home", () => {
    expect(isSlugReachable("/about")).toBe(true);
    expect(isSlugReachable("/blog/post")).toBe(true);
    expect(isSlugReachable("/")).toBe(true);
  });
});

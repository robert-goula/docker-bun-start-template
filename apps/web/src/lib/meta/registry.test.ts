import { describe, expect, it } from "vitest";
import { defaultsForModule, headTagsForPage, sanitizeModules } from "./registry";
import type { MetaContext, PageMetaData } from "./types";

const ctx: MetaContext = {
  ref: { slug: "/about", locale: "en-us" },
  slug: "/about",
  locale: "en-us",
};

describe("headTagsForPage", () => {
  it("emits title + description from the basic module", () => {
    const modules: PageMetaData = { basic: { title: "About", description: "We are…" } };
    const { meta } = headTagsForPage(modules, ctx);
    expect(meta).toContainEqual({ title: "About" });
    expect(meta).toContainEqual({ name: "description", content: "We are…" });
  });

  it("omits the description tag when description is empty/null", () => {
    const { meta } = headTagsForPage({ basic: { title: "About", description: null } }, ctx);
    expect(meta).toEqual([{ title: "About" }]);
  });

  it("emits og:* property tags from the Open Graph module", () => {
    const modules: PageMetaData = {
      basic: { title: "About", description: null },
      openGraph: { title: "OG About", image: "https://x.test/a.png" },
    };
    const { meta } = headTagsForPage(modules, ctx);
    expect(meta).toContainEqual({ property: "og:title", content: "OG About" });
    expect(meta).toContainEqual({ property: "og:image", content: "https://x.test/a.png" });
    // type defaults to "website" via the module defaults.
    expect(meta).toContainEqual({ property: "og:type", content: "website" });
  });

  it("ignores unknown module ids", () => {
    const modules: PageMetaData = {
      basic: { title: "About", description: null },
      bogus: { whatever: "x" },
    };
    const { meta } = headTagsForPage(modules, ctx);
    expect(meta).toEqual([{ title: "About" }]);
  });
});

describe("sanitizeModules", () => {
  it("strips the basic module and unknown ids, keeping valid extension data", () => {
    const out = sanitizeModules({
      basic: { title: "should be dropped" },
      bogus: { x: 1 },
      openGraph: { title: "Keep" },
    });
    expect(out.basic).toBeUndefined();
    expect(out.bogus).toBeUndefined();
    expect(out.openGraph).toMatchObject({ title: "Keep", type: "website" });
  });
});

describe("defaultsForModule", () => {
  it("returns a module's defaults and {} for unknown ids", () => {
    expect(defaultsForModule("openGraph")).toMatchObject({ type: "website" });
    expect(defaultsForModule("nope")).toEqual({});
  });
});

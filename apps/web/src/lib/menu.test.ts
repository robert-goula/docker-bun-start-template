import { describe, expect, it } from "vitest";
import type { MenuItem } from "@/db/schema/menus";
import { indexPagesByGroup, type PageGroupRow, resolveMenuItems } from "./menu";

const pageItem = (
  id: string,
  groupId: string,
  label?: string,
  children: MenuItem[] = [],
): MenuItem => ({
  id,
  type: "page",
  groupId,
  label,
  children,
});

describe("indexPagesByGroup", () => {
  const rows: PageGroupRow[] = [
    { groupId: "g1", slug: "/about", title: "About", locale: "en-us" },
    { groupId: "g1", slug: "/acerca-de", title: "Acerca de", locale: "es-us" },
    { groupId: "g2", slug: "/contact", title: "Contact", locale: "en-us" },
  ];

  it("prefers the requested locale's row", () => {
    const map = indexPagesByGroup(rows, "es-us");
    expect(map.get("g1")).toEqual({ slug: "/acerca-de", title: "Acerca de" });
  });

  it("falls back to the default-locale row when the translation is missing", () => {
    // g2 only has an en-us row; requesting es-us should still resolve it.
    const map = indexPagesByGroup(rows, "es-us");
    expect(map.get("g2")).toEqual({ slug: "/contact", title: "Contact" });
  });

  it("is order-independent (locale row before or after the fallback)", () => {
    const reversed = [...rows].reverse();
    expect(indexPagesByGroup(reversed, "es-us").get("g1")).toEqual({
      slug: "/acerca-de",
      title: "Acerca de",
    });
  });
});

describe("resolveMenuItems", () => {
  const pageFor = (groupId: string) =>
    ({ g1: { slug: "/about", title: "About" }, g2: { slug: "/blog/post", title: "Post" } })[
      groupId
    ];

  it("resolves a page item to the locale's href + title", () => {
    const links = resolveMenuItems([pageItem("a", "g1")], "en-us", pageFor);
    expect(links).toEqual([{ id: "a", label: "About", href: "/about", children: [] }]);
  });

  it("prefixes non-default locales via buildHref", () => {
    const links = resolveMenuItems([pageItem("a", "g1")], "es-us", pageFor);
    expect(links[0].href).toBe("/es-us/about");
  });

  it("lets an explicit label override the page title", () => {
    const links = resolveMenuItems([pageItem("a", "g1", "Home")], "en-us", pageFor);
    expect(links[0].label).toBe("Home");
  });

  it("keeps external href/label/newTab and emits no href for headings", () => {
    const items: MenuItem[] = [
      { id: "e", type: "external", href: "https://x.test", label: "X", newTab: true, children: [] },
      { id: "h", type: "heading", label: "Group", children: [] },
    ];
    const links = resolveMenuItems(items, "en-us", pageFor);
    expect(links[0]).toEqual({
      id: "e",
      label: "X",
      href: "https://x.test",
      newTab: true,
      children: [],
    });
    expect(links[1]).toEqual({ id: "h", label: "Group", children: [] });
    expect(links[1].href).toBeUndefined();
  });

  it("resolves nested children", () => {
    const items: MenuItem[] = [
      { id: "h", type: "heading", label: "More", children: [pageItem("a", "g2")] },
    ];
    const links = resolveMenuItems(items, "en-us", pageFor);
    expect(links[0].children).toEqual([
      { id: "a", label: "Post", href: "/blog/post", children: [] },
    ]);
  });

  it("drops a page item (and its subtree) whose group no longer resolves", () => {
    const items: MenuItem[] = [pageItem("gone", "missing", undefined, [pageItem("child", "g1")])];
    expect(resolveMenuItems(items, "en-us", pageFor)).toEqual([]);
  });
});

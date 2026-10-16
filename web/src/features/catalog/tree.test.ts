import { describe, expect, it } from "vitest";
import { CatalogError } from "./errors";
import { buildPath, planMove, slugify, toOutline } from "./tree";

const node = (id: string, path: string, extra: { isOther?: boolean; archivedAt?: Date | null } = {}) => ({
  id,
  path,
  isOther: extra.isOther ?? false,
  archivedAt: extra.archivedAt ?? null,
});

// electronics > components > cpu ; books
const tree = [
  node("electronics", "/electronics/"),
  node("components", "/electronics/components/"),
  node("cpu", "/electronics/components/cpu/"),
  node("ram", "/electronics/components/ram/"),
  node("books", "/books/"),
  node("other", "/books/other/", { isOther: true }),
];
const subtreeOf = (n: { path: string }) => tree.filter((t) => t.path.startsWith(n.path));
const get = (id: string) => tree.find((t) => t.id === id)!;

describe("category paths", () => {
  it("builds materialised paths", () => {
    expect(buildPath(null, "a")).toBe("/a/");
    expect(buildPath("/a/", "b")).toBe("/a/b/");
  });

  it("moves a subtree under a new parent and rewrites every descendant path", () => {
    expect(planMove(get("components"), get("books"), subtreeOf(get("components")))).toEqual([
      { id: "components", path: "/books/components/" },
      { id: "cpu", path: "/books/components/cpu/" },
      { id: "ram", path: "/books/components/ram/" },
    ]);
  });

  it("moves a subtree to the top level", () => {
    expect(planMove(get("components"), null, subtreeOf(get("components")))).toEqual([
      { id: "components", path: "/components/" },
      { id: "cpu", path: "/components/cpu/" },
      { id: "ram", path: "/components/ram/" },
    ]);
  });

  it("rejects moving under itself, a descendant, an Other leaf or an archived parent", () => {
    const cases = [
      [get("components"), get("components")],
      [get("electronics"), get("cpu")],
      [get("cpu"), get("other")],
      [get("cpu"), node("old", "/old/", { archivedAt: new Date() })],
    ] as const;
    for (const [n, parent] of cases) {
      expect(() => planMove(n, parent, subtreeOf(n))).toThrow(CatalogError);
    }
  });

  it("does not confuse ids that share a prefix", () => {
    // "/a/" must not match "/ab/": paths end with a slash.
    const a = node("a", "/a/");
    const ab = node("ab", "/ab/");
    expect(ab.path.startsWith(a.path)).toBe(false);
    expect(() => planMove(a, ab, [a])).not.toThrow();
  });
});

describe("toOutline and slugify", () => {
  it("lists depth-first, children by name, Other last", () => {
    const rows = [
      { id: "f", parentId: null, name: "Fashion", isOther: false },
      { id: "o", parentId: "f", name: "Other", isOther: true },
      { id: "w", parentId: "f", name: "Women's Tops", isOther: false },
      { id: "m", parentId: "f", name: "Men's Pants", isOther: false },
      { id: "b", parentId: null, name: "Books", isOther: false },
    ];
    expect(toOutline(rows).map((r) => `${r.depth}:${r.id}`)).toEqual(["0:b", "0:f", "1:m", "1:w", "1:o"]);
  });

  it("makes URL slugs", () => {
    expect(slugify("Children's")).toBe("childrens");
    expect(slugify("Men's Pants")).toBe("mens-pants");
    expect(slugify("Calcium + D3")).toBe("calcium-d3");
  });
});

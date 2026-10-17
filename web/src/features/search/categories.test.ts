import { describe, expect, it } from "vitest";
import { buildVisibleTree, findVisible, type CategoryRow } from "./categories";

function row(id: string, parent: CategoryRow | null, extra: Partial<CategoryRow> = {}): CategoryRow {
  return {
    id,
    parentId: parent?.id ?? null,
    name: id[0].toUpperCase() + id.slice(1),
    slug: id,
    path: `${parent?.path ?? "/"}${id}/`,
    isLeaf: true,
    isOther: false,
    archivedAt: null,
    ...extra,
  };
}

const electronics = row("electronics", null, { isLeaf: false });
const components = row("components", electronics, { isLeaf: false });
const processor = row("processor", components);
const ram = row("ram", components);
const motherboard = row("motherboard", components);
const componentsOther = row("components-other", components, { name: "Other", isOther: true });
const books = row("books", null, { isLeaf: false });
const fiction = row("fiction", books);
const fashion = row("fashion", null, { isLeaf: false });
const tops = row("tops", fashion);
const rows = [electronics, components, processor, ram, motherboard, componentsOther, books, fiction, fashion, tops];

describe("visible categories (US-040)", () => {
  it("shows only categories with live in-stock products; leaf counts roll up to parents", () => {
    const tree = buildVisibleTree(rows, new Map([["processor", 3], ["ram", 1], ["fiction", 2], ["components-other", 1]]));
    expect(tree.map((c) => [c.slug, c.count])).toEqual([
      ["books", 2],
      ["electronics", 5],
    ]);
    const comp = tree[1].children[0];
    expect(comp).toMatchObject({ slug: "components", count: 5, isLeaf: false });
    // Sorted by name, "Other" last; the empty Motherboard is hidden.
    expect(comp.children.map((c) => c.slug)).toEqual(["processor", "ram", "components-other"]);
    expect(JSON.stringify(tree)).not.toContain("motherboard");
    // Fashion has no products at all: the whole branch is hidden.
    expect(tree.some((c) => c.slug === "fashion")).toBe(false);
  });

  it("hides a branch under an archived category", () => {
    const archived = rows.map((r) => (r.id === "components" ? { ...r, archivedAt: new Date() } : r));
    const tree = buildVisibleTree(archived, new Map([["processor", 3], ["fiction", 1]]));
    expect(tree.map((c) => c.slug)).toEqual(["books"]);
  });

  it("is empty when nothing is listed", () => {
    expect(buildVisibleTree(rows, new Map())).toEqual([]);
    expect(buildVisibleTree(rows, new Map([["processor", 0]]))).toEqual([]);
  });

  it("finds a visible category with its breadcrumb trail", () => {
    const tree = buildVisibleTree(rows, new Map([["processor", 3]]));
    const found = findVisible(tree, "processor")!;
    expect(found.trail.map((c) => c.slug)).toEqual(["electronics", "components", "processor"]);
    expect(found.node.count).toBe(3);
    expect(findVisible(tree, "motherboard")).toBeNull();
    expect(findVisible(tree, "nope")).toBeNull();
  });
});

import { pathIds } from "./documents";

/**
 * US-040 (D11): shoppers see only categories with at least one live, in-stock product. Leaf
 * counts roll up to every ancestor; a branch under an archived category is hidden. Pure, so the
 * visibility rule is unit-tested; the counts come from one grouped query (repo.ts).
 */

export interface CategoryRow {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  path: string;
  isLeaf: boolean;
  isOther: boolean;
  archivedAt: Date | null;
}

export interface VisibleCategory {
  id: string;
  name: string;
  slug: string;
  isLeaf: boolean;
  /** Live, in-stock products in this category and everything under it. */
  count: number;
  children: VisibleCategory[];
}

const byName = (a: { name: string; isOther?: boolean }, b: { name: string; isOther?: boolean }) =>
  Number(!!a.isOther) - Number(!!b.isOther) || a.name.localeCompare(b.name);

export function buildVisibleTree(rows: CategoryRow[], countsByCategory: Map<string, number>): VisibleCategory[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const hidden = (r: CategoryRow) => pathIds(r.path).some((id) => !byId.has(id) || byId.get(id)!.archivedAt !== null);

  const totals = new Map<string, number>();
  for (const row of rows) {
    const count = countsByCategory.get(row.id) ?? 0;
    if (count <= 0 || hidden(row)) continue;
    for (const id of pathIds(row.path)) totals.set(id, (totals.get(id) ?? 0) + count);
  }

  const nodes = new Map<string, VisibleCategory & { isOther: boolean }>();
  for (const row of rows) {
    const count = totals.get(row.id) ?? 0;
    if (count > 0) nodes.set(row.id, { id: row.id, name: row.name, slug: row.slug, isLeaf: row.isLeaf, count, children: [], isOther: row.isOther });
  }
  const roots: (VisibleCategory & { isOther: boolean })[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id);
    if (!node) continue;
    const parent = row.parentId ? nodes.get(row.parentId) : undefined;
    if (parent) parent.children.push(node);
    else if (!row.parentId) roots.push(node);
  }
  const strip = (list: (VisibleCategory & { isOther: boolean })[]): VisibleCategory[] =>
    [...list].sort(byName).map((n) => ({
      id: n.id,
      name: n.name,
      slug: n.slug,
      isLeaf: n.isLeaf,
      count: n.count,
      children: strip(n.children as (VisibleCategory & { isOther: boolean })[]),
    }));
  return strip(roots);
}

/** A visible category by slug with its trail from the root (for breadcrumbs). */
export function findVisible(tree: VisibleCategory[], slug: string): { node: VisibleCategory; trail: VisibleCategory[] } | null {
  for (const node of tree) {
    if (node.slug === slug) return { node, trail: [node] };
    const found = findVisible(node.children, slug);
    if (found) return { node: found.node, trail: [node, ...found.trail] };
  }
  return null;
}

import { CatalogError } from "./errors";

/** Materialised path of ids: "/rootId/childId/". A node's path ends with its own id. */
export function buildPath(parentPath: string | null, id: string): string {
  return `${parentPath ?? "/"}${id}/`;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Depth-first order (children sorted by name, "Other" last) with each node's depth, for display. */
export function toOutline<T extends { id: string; parentId: string | null; name: string; isOther: boolean }>(
  nodes: T[],
): (T & { depth: number })[] {
  const byParent = new Map<string | null, T[]>();
  for (const n of nodes) byParent.set(n.parentId, [...(byParent.get(n.parentId) ?? []), n]);
  const out: (T & { depth: number })[] = [];
  const walk = (parentId: string | null, depth: number) => {
    const children = (byParent.get(parentId) ?? []).sort(
      (a, b) => Number(a.isOther) - Number(b.isOther) || a.name.localeCompare(b.name),
    );
    for (const child of children) {
      out.push({ ...child, depth });
      walk(child.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

interface TreeNode {
  id: string;
  path: string;
  isOther: boolean;
  archivedAt: Date | null;
}

/**
 * Plans a move of `node` (and its subtree) under `newParent` (null = root).
 * `subtree` holds the node and all its descendants (every row whose path starts with node.path).
 * Returns the new path for each of them.
 */
export function planMove(
  node: TreeNode,
  newParent: TreeNode | null,
  subtree: { id: string; path: string }[],
): { id: string; path: string }[] {
  if (newParent) {
    if (newParent.path.startsWith(node.path)) {
      throw new CatalogError(422, "INVALID_MOVE", "A category cannot move under itself or its own subcategory");
    }
    if (newParent.isOther) throw new CatalogError(422, "INVALID_MOVE", "An \"Other\" leaf cannot have subcategories");
    if (newParent.archivedAt) throw new CatalogError(422, "INVALID_MOVE", "The new parent is archived");
  }
  const newPath = buildPath(newParent?.path ?? null, node.id);
  return subtree.map((n) => ({ id: n.id, path: newPath + n.path.slice(node.path.length) }));
}

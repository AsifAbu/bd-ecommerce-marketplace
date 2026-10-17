import Link from "next/link";
import type { VisibleCategory } from "../categories";
import { getVisibleCategoryTree } from "../server";
import { linkClass } from "./styles";

/** US-040: categories with live, in-stock products only, each with its product count. */

function Branch({ nodes, depth }: { nodes: VisibleCategory[]; depth: number }) {
  return (
    <ul className={depth === 0 ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "ml-4 flex flex-col gap-1"}>
      {nodes.map((c) => (
        <li key={c.id} className={depth === 0 ? "flex flex-col gap-2 rounded border border-gray-300 p-4" : ""}>
          <Link className={depth === 0 ? `${linkClass} text-lg font-semibold` : linkClass} href={`/c/${c.slug}`}>
            {c.name}
          </Link>{" "}
          <span className="text-sm text-gray-700">({c.count})</span>
          {c.children.length > 0 && <Branch nodes={c.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

export async function CategoryTreeNav() {
  const tree = await getVisibleCategoryTree();
  if (tree.length === 0) return <p>No products are listed yet. Please check back soon.</p>;
  return (
    <nav aria-label="Categories">
      <Branch nodes={tree} depth={0} />
    </nav>
  );
}

/** Home page: top-level categories and their direct children. */
export async function CategoryShortcuts() {
  const tree = await getVisibleCategoryTree();
  if (tree.length === 0) return null;
  return (
    <section aria-labelledby="shop-by-category" className="flex flex-col gap-3">
      <h2 id="shop-by-category" className="text-xl font-semibold">
        Shop by category
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {tree.map((c) => (
          <li key={c.id} className="rounded border border-gray-300 p-3">
            <Link className={`${linkClass} font-semibold`} href={`/c/${c.slug}`}>
              {c.name}
            </Link>{" "}
            <span className="text-sm text-gray-700">({c.count})</span>
            {c.children.length > 0 && (
              <ul className="mt-1 flex flex-wrap gap-x-3 text-sm">
                {c.children.map((child) => (
                  <li key={child.id}>
                    <Link className={linkClass} href={`/c/${child.slug}`}>
                      {child.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <Link className={linkClass} href="/categories">
        All categories
      </Link>
    </section>
  );
}

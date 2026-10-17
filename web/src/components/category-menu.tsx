import Link from "next/link";
import { connection } from "next/server";
import { getVisibleCategoryTree } from "@/features/search/server";

/**
 * Header category menu: a dropdown (native <details>, works without JavaScript) listing the
 * top-level categories that have live products.
 */
export async function CategoryMenu() {
  await connection(); // product counts change at request time
  let tree: Awaited<ReturnType<typeof getVisibleCategoryTree>> = [];
  try {
    tree = await getVisibleCategoryTree();
  } catch {
    // The menu is a convenience: fall back to the plain link if the database is unreachable.
  }
  if (tree.length === 0) return <CategoryLink />;
  return (
    <nav aria-label="Shop menu" className="relative">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1 rounded bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 [&::-webkit-details-marker]:hidden">
          Browse categories
          <span aria-hidden="true" className="text-xs transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <ul className="absolute left-0 top-full z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-300 bg-white p-2 shadow-lg">
          {tree.map((c) => (
            <li key={c.id}>
              <Link
                href={`/c/${c.slug}`}
                className="flex items-center justify-between rounded px-3 py-2 text-sm font-medium hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700"
              >
                {c.name}
                <span className="text-xs text-gray-600">{c.count}</span>
              </Link>
            </li>
          ))}
          <li className="mt-1 border-t border-gray-200 pt-1">
            <Link
              href="/categories"
              className="block rounded px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              All categories
            </Link>
          </li>
        </ul>
      </details>
    </nav>
  );
}

export function CategoryLink() {
  return (
    <Link href="/categories" className="rounded bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800">
      Browse categories
    </Link>
  );
}

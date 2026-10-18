import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { cache } from "react";
import { connection } from "next/server";
import { getVisibleCategoryTree } from "@/features/search/server";
import { DisclosureMenu, buttonStyles, menuItemStyles } from "./ui";

/** Top-level categories with live products. Cached per request: the header menu and the mobile drawer share one query. */
export const loadCategoryTree = cache(async () => {
  await connection(); // product counts change at request time
  try {
    return await getVisibleCategoryTree();
  } catch {
    // The menu is a convenience: fall back to the plain link if the database is unreachable.
    return [];
  }
});

/**
 * Header category menu (desktop): a dropdown (native <details>, works without JavaScript) listing
 * the top-level categories that have live products.
 */
export async function CategoryMenu() {
  const tree = await loadCategoryTree();
  if (tree.length === 0) return <CategoryLink />;
  return (
    <nav aria-label="Shop menu" className="relative">
      <DisclosureMenu
        summary={
          <>
            Browse categories
            <ChevronDown aria-hidden="true" size={16} className="transition-transform group-open:rotate-180" />
          </>
        }
        panelClassName="left-0 right-auto"
      >
        <ul>
          {tree.map((c) => (
            <li key={c.id}>
              <Link href={`/c/${c.slug}`} className={menuItemStyles}>
                {c.name}
                <span className="tabular text-xs text-muted">{c.count}</span>
              </Link>
            </li>
          ))}
          <li className="mt-1 border-t border-line pt-1">
            <Link href="/categories" className={`${menuItemStyles} font-medium text-jade`}>
              All categories
            </Link>
          </li>
        </ul>
      </DisclosureMenu>
    </nav>
  );
}

export function CategoryLink() {
  return (
    <Link href="/categories" className={buttonStyles({ variant: "ghost" })}>
      Browse categories
    </Link>
  );
}

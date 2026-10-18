import Link from "next/link";
import { buttonStyles, EmptyState } from "@/components/ui";
import type { VisibleCategory } from "../categories";
import { getVisibleCategoryTree } from "../server";

/** US-040: categories with live, in-stock products only, each with its product count. */

const link = "inline-flex min-h-11 items-center rounded-sm hover:underline underline-offset-4";

function Children({ nodes }: { nodes: VisibleCategory[] }) {
  return (
    <ul className="flex flex-col">
      {nodes.map((c) => (
        <li key={c.id}>
          <Link className={`${link} text-muted hover:text-ink`} href={`/c/${c.slug}`}>
            {c.name}
          </Link>{" "}
          <span className="tabular text-sm text-muted">({c.count})</span>
          {c.children.length > 0 && (
            <div className="ml-4">
              <Children nodes={c.children} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export async function CategoryTreeNav() {
  const tree = await getVisibleCategoryTree();
  if (tree.length === 0) {
    return (
      <EmptyState
        title="No products are listed yet"
        description="Shops are getting ready. Please check back soon."
        action={
          <Link className={buttonStyles({ variant: "secondary" })} href="/shops/apply">
            Open your shop
          </Link>
        }
      />
    );
  }
  return (
    <nav aria-label="Categories">
      <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {tree.map((c) => (
          <li key={c.id} className="flex flex-col">
            <div>
              <Link className={`${link} text-lg font-semibold`} href={`/c/${c.slug}`}>
                {c.name}
              </Link>{" "}
              <span className="tabular text-sm text-muted">({c.count})</span>
            </div>
            {c.children.length > 0 && <Children nodes={c.children} />}
          </li>
        ))}
      </ul>
    </nav>
  );
}

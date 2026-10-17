import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getVisibleCategory } from "@/features/search/server";
import { SearchResultsView } from "@/features/search/ui/search-view";

export const metadata: Metadata = { title: "Category · Marketplace" };

/**
 * US-040 / US-042: a category's products with its filters. Only categories with live, in-stock
 * products exist for shoppers; an empty, archived or unknown category is a 404.
 */
export default function CategoryPage({ params, searchParams }: PageProps<"/c/[slug]">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <Suspense fallback={<p>Loading products…</p>}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const [{ slug }, raw] = await Promise.all([params, searchParams]);
  const found = await getVisibleCategory(slug);
  if (!found) notFound();
  return (
    <SearchResultsView
      basePath={`/c/${slug}`}
      raw={{ ...raw, category: slug }}
      trail={found.trail}
      subcategories={found.node.children}
    />
  );
}

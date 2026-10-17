import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { SearchResultsView } from "@/features/search/ui/search-view";

export const metadata: Metadata = { title: "Search · Marketplace" };

/** US-041, US-042: /search?q=&category=&f.<key>=&price_min=&price_max=&shop=&sort=&page= */
export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <Suspense fallback={<p>Loading results…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Results({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  return <SearchResultsView basePath="/search" raw={await searchParams} />;
}

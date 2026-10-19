import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Container } from "@/components/ui";
import { ResultsSkeleton, SearchResultsView } from "@/features/search/ui/search-view";

export const metadata: Metadata = { title: "Search · Dokan" };

/** US-041, US-042: /search?q=&category=&f.<key>=&price_min=&price_max=&shop=&sort=&page= */
export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <Container as="main" id="main" className="flex flex-1 flex-col py-6 sm:py-8">
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function Results({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  return <SearchResultsView basePath="/search" raw={await searchParams} />;
}

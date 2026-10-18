import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Container, Skeleton } from "@/components/ui";
import { CategoryTreeNav } from "@/features/search/ui/category-nav";

export const metadata: Metadata = { title: "Categories · Marketplace" };

/** US-040: every category that has products (empty ones stay hidden). */
export default function CategoriesPage() {
  return (
    <Container as="main" className="flex flex-1 flex-col gap-6 py-6 sm:py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold sm:text-4xl">All categories</h1>
        <p className="text-muted">Every category with products in stock right now.</p>
      </header>
      <Suspense fallback={<CategoriesSkeleton />}>
        <Tree />
      </Suspense>
    </Container>
  );
}

async function Tree() {
  await connection();
  return <CategoryTreeNav />;
}

function CategoriesSkeleton() {
  return (
    <div role="status" className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
      <span className="sr-only">Loading categories…</span>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}

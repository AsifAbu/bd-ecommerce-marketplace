import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CategoryTreeNav } from "@/features/search/ui/category-nav";

export const metadata: Metadata = { title: "Categories · Marketplace" };

/** US-040: every category that has products (empty ones stay hidden). */
export default function CategoriesPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">All categories</h1>
      <Suspense fallback={<p>Loading categories…</p>}>
        <Tree />
      </Suspense>
    </main>
  );
}

async function Tree() {
  await connection();
  return <CategoryTreeNav />;
}

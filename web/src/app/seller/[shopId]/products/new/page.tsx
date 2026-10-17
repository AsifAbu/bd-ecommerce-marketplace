import { connection } from "next/server";
import { Suspense } from "react";
import { requireShopRole } from "@/lib/auth";
import { NewProductView } from "@/features/products/ui/views";
import { guardPage } from "@/features/shops/page-guard";

export default function NewProductPage({ params, searchParams }: PageProps<"/seller/[shopId]/products/new">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-10">
      <Suspense fallback={<p>Loading…</p>}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ shopId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { shopId } = await params;
  const { categoryId } = await searchParams;
  const access = await guardPage(`/seller/${shopId}/products/new`, () => requireShopRole(shopId, ["owner", "staff"]));
  return <NewProductView shopId={access.shopId} categoryId={typeof categoryId === "string" ? categoryId : undefined} />;
}

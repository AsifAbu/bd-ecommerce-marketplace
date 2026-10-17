import { connection } from "next/server";
import { Suspense } from "react";
import { requireShopRole } from "@/lib/auth";
import { ImportView } from "@/features/products/ui/views";
import { guardPage } from "@/features/shops/page-guard";

export default function ImportProductsPage({ params, searchParams }: PageProps<"/seller/[shopId]/products/import">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-10">
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
  const access = await guardPage(`/seller/${shopId}/products/import`, () => requireShopRole(shopId, ["owner", "staff"]));
  return <ImportView shopId={access.shopId} categoryId={typeof categoryId === "string" ? categoryId : undefined} />;
}

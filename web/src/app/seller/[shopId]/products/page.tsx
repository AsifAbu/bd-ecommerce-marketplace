import { connection } from "next/server";
import { Suspense } from "react";
import { requireShopRole } from "@/lib/auth";
import { ProductListView } from "@/features/products/ui/views";
import { guardPage } from "@/features/shops/page-guard";

export default function ProductsPage({ params }: PageProps<"/seller/[shopId]/products">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-10">
      <Suspense fallback={<p>Loading…</p>}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: Promise<{ shopId: string }> }) {
  await connection();
  const { shopId } = await params;
  const access = await guardPage(`/seller/${shopId}/products`, () => requireShopRole(shopId, ["owner", "staff"]));
  return <ProductListView shopId={access.shopId} />;
}

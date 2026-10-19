import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { requireShopRole } from "@/lib/auth";
import { ProductListView } from "@/features/products/ui/views";
import { guardPage } from "@/features/shops/page-guard";

export const metadata = { title: "Products" };

export default function ProductsPage({ params }: PageProps<"/seller/[shopId]/products">) {
  return (
    <Suspense fallback={<ProductsSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}

function ProductsSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">Loading products…</span>
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-5 w-72" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

async function Content({ params }: { params: Promise<{ shopId: string }> }) {
  await connection();
  const { shopId } = await params;
  const access = await guardPage(`/seller/${shopId}/products`, () => requireShopRole(shopId, ["owner", "staff"]));
  return <ProductListView shopId={access.shopId} />;
}

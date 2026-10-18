import { connection } from "next/server";
import { Suspense } from "react";
import { requireShopRole } from "@/lib/auth";
import { ListSkeleton } from "@/features/accounts/ui/auth-shell";
import { ImportView } from "@/features/products/ui/views";
import { guardPage } from "@/features/shops/page-guard";

export const metadata = { title: "Import products" };

export default function ImportProductsPage({ params, searchParams }: PageProps<"/seller/[shopId]/products/import">) {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
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

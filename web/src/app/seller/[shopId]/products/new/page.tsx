import { connection } from "next/server";
import { Suspense } from "react";
import { requireShopRole } from "@/lib/auth";
import { ListSkeleton } from "@/features/accounts/ui/auth-shell";
import { NewProductView } from "@/features/products/ui/views";
import { guardPage } from "@/features/shops/page-guard";

export const metadata = { title: "Add a product" };

export default function NewProductPage({ params, searchParams }: PageProps<"/seller/[shopId]/products/new">) {
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
  const { categoryId, copyFrom, q } = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const access = await guardPage(`/seller/${shopId}/products/new`, () => requireShopRole(shopId, ["owner", "staff"]));
  return <NewProductView shopId={access.shopId} categoryId={one(categoryId)} copyFrom={one(copyFrom)} q={one(q)?.slice(0, 80)} />;
}

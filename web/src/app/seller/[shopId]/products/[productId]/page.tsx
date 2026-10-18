import { connection } from "next/server";
import { Suspense } from "react";
import { requireShopRole } from "@/lib/auth";
import { ListSkeleton } from "@/features/accounts/ui/auth-shell";
import { EditProductView } from "@/features/products/ui/views";
import { guardPage } from "@/features/shops/page-guard";

export const metadata = { title: "Edit product" };

export default function EditProductPage({ params, searchParams }: PageProps<"/seller/[shopId]/products/[productId]">) {
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
  params: Promise<{ shopId: string; productId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { shopId, productId } = await params;
  const query = await searchParams;
  const access = await guardPage(`/seller/${shopId}/products/${productId}`, () => requireShopRole(shopId, ["owner", "staff"]));
  const notice = query.created ? "Product created. Add images below." : query.saved ? "Changes saved." : undefined;
  return <EditProductView shopId={access.shopId} productId={productId} notice={notice} />;
}

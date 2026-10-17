import { connection } from "next/server";
import { Suspense } from "react";
import { requireShopRole } from "@/lib/auth";
import { EditProductView } from "@/features/products/ui/views";
import { guardPage } from "@/features/shops/page-guard";

export default function EditProductPage({ params, searchParams }: PageProps<"/seller/[shopId]/products/[productId]">) {
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

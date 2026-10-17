import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { shopOrderDetail } from "@/features/orders/lifecycle/server";
import { ShopOrderDetail } from "@/features/orders/lifecycle/ui/shop-order-detail";
import { guardPage } from "@/features/shops/page-guard";
import { requireShopRole } from "@/lib/auth";

export const metadata = { title: "Shop order" };

/** Seller centre (US-053): one shop order with its next step, the 48 h countdown and the timeline. */
export default function ShopOrderPage({ params }: PageProps<"/seller/[shopId]/orders/[shopOrderId]">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-10">
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: Promise<{ shopId: string; shopOrderId: string }> }) {
  await connection();
  const { shopId, shopOrderId } = await params;
  const access = await guardPage(`/seller/${shopId}/orders/${shopOrderId}`, () => requireShopRole(shopId, ["owner", "staff"]));
  const so = await shopOrderDetail({ shopId: access.shopId, role: access.role }, shopOrderId);
  if (!so) notFound();
  const base = `/seller/${access.shopId}/orders`;
  return <ShopOrderDetail so={so} scope={{ kind: "shop", shopId: access.shopId }} backHref={base} packingSlipHref={`${base}/${so.id}/packing-slip`} />;
}

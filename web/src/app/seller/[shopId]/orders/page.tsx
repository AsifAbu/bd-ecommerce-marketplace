import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { shopOrdersOf } from "@/features/orders/server";
import { SellerOrders } from "@/features/orders/ui/seller-orders";
import { guardPage } from "@/features/shops/page-guard";
import { requireShopRole } from "@/lib/auth";

export const metadata = { title: "Shop orders" };

/** Seller centre: this shop's orders (owner and staff; scoped by shop). Lifecycle actions come in Sprint 7. */
export default function ShopOrdersPage({ params }: PageProps<"/seller/[shopId]/orders">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Orders</h1>
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: Promise<{ shopId: string }> }) {
  await connection();
  const { shopId } = await params;
  const access = await guardPage(`/seller/${shopId}/orders`, () => requireShopRole(shopId, ["owner", "staff"]));
  return (
    <>
      <p className="text-sm">
        <Link className="text-blue-800 underline" href={`/seller/${access.shopId}`}>
          Back to the shop dashboard
        </Link>
      </p>
      <SellerOrders orders={await shopOrdersOf(access.shopId)} />
    </>
  );
}

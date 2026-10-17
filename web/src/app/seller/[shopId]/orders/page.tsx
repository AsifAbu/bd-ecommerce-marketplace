import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { pageFilters, shopOrderList } from "@/features/orders/lifecycle/server";
import { ShopOrderList } from "@/features/orders/lifecycle/ui/shop-order-list";
import { guardPage } from "@/features/shops/page-guard";
import { requireShopRole } from "@/lib/auth";

export const metadata = { title: "Shop orders" };

/** Seller centre (US-053): this shop's orders with status/overdue filters and the 48 h countdown (owner and staff). */
export default function ShopOrdersPage({ params, searchParams }: PageProps<"/seller/[shopId]/orders">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Orders</h1>
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({ params, searchParams }: { params: Promise<{ shopId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const { shopId } = await params;
  const access = await guardPage(`/seller/${shopId}/orders`, () => requireShopRole(shopId, ["owner", "staff"]));
  const filters = pageFilters(await searchParams);
  const { orders, overdueCount } = await shopOrderList(access.shopId, filters);
  return (
    <>
      <p className="text-sm">
        <Link className="text-blue-800 underline" href={`/seller/${access.shopId}`}>
          Back to the shop dashboard
        </Link>
      </p>
      <p className="text-sm">Confirm, pack and hand over every order to the courier within 48 hours of the order (Bangladesh e-commerce rules).</p>
      <ShopOrderList orders={orders} basePath={`/seller/${access.shopId}/orders`} filters={filters} overdueCount={overdueCount} />
    </>
  );
}

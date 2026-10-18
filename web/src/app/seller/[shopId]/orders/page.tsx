import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { ListSkeleton } from "@/features/accounts/ui/auth-shell";
import { pageFilters, shopOrderList } from "@/features/orders/lifecycle/server";
import { ShopOrderList } from "@/features/orders/lifecycle/ui/shop-order-list";
import { guardPage } from "@/features/shops/page-guard";
import { requireShopRole } from "@/lib/auth";

export const metadata = { title: "Shop orders" };

/** Seller centre (US-053): this shop's orders with status/overdue filters and the 48 h countdown (owner and staff). */
export default function ShopOrdersPage({ params, searchParams }: PageProps<"/seller/[shopId]/orders">) {
  return (
    <>
      <PageHeader title="Orders" description="Confirm, pack and hand over every order to the courier within 48 hours of the order (Bangladesh e-commerce rules)." />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Content({ params, searchParams }: { params: Promise<{ shopId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const { shopId } = await params;
  const access = await guardPage(`/seller/${shopId}/orders`, () => requireShopRole(shopId, ["owner", "staff"]));
  const filters = pageFilters(await searchParams);
  const { orders, overdueCount } = await shopOrderList(access.shopId, filters);
  return <ShopOrderList orders={orders} basePath={`/seller/${access.shopId}/orders`} filters={filters} overdueCount={overdueCount} />;
}

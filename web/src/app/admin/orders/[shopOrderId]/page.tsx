import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/loading";
import { shopOrderDetail } from "@/features/orders/lifecycle/server";
import { ShopOrderDetail } from "@/features/orders/lifecycle/ui/shop-order-detail";
import { guardPage } from "@/features/shops/page-guard";
import { requirePlatformAdmin } from "@/lib/auth";

export const metadata = { title: "Shop order: admin" };

/** Admin (US-053): one shop order with every action the admin may take (delivery is recorded here until a courier feed exists). */
export default function AdminShopOrderPage({ params }: PageProps<"/admin/orders/[shopOrderId]">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ shopOrderId: string }> }) {
  await connection();
  const { shopOrderId } = await params;
  await guardPage(`/admin/orders/${shopOrderId}`, requirePlatformAdmin);
  const so = await shopOrderDetail("admin", shopOrderId);
  if (!so) notFound();
  return <ShopOrderDetail so={so} scope={{ kind: "admin" }} backHref="/admin/orders" />;
}

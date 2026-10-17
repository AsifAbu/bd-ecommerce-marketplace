import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { shopOrderDetail } from "@/features/orders/lifecycle/server";
import { ShopOrderDetail } from "@/features/orders/lifecycle/ui/shop-order-detail";
import { guardPage } from "@/features/shops/page-guard";
import { requirePlatformAdmin } from "@/lib/auth";

export const metadata = { title: "Shop order: admin" };

/** Admin (US-053): one shop order with every action the admin may take (delivery is recorded here until a courier feed exists). */
export default function AdminShopOrderPage({ params }: PageProps<"/admin/orders/[shopOrderId]">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-10">
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Content params={params} />
      </Suspense>
    </main>
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

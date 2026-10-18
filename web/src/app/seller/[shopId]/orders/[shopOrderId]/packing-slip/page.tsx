import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { shopOrderDetail } from "@/features/orders/lifecycle/server";
import { PackingSlip } from "@/features/orders/lifecycle/ui/packing-slip";
import { guardPage } from "@/features/shops/page-guard";
import { requireShopRole } from "@/lib/auth";

export const metadata = { title: "Packing slip", robots: { index: false } };

/** Printable packing slip for one shop order (owner and staff of that shop). Inside the seller layout's <main>; its nav is hidden when printing. */
export default function PackingSlipPage({ params }: PageProps<"/seller/[shopId]/orders/[shopOrderId]/packing-slip">) {
  return (
    <div className="flex max-w-3xl flex-col gap-6 print:max-w-none">
      <Suspense fallback={<p role="status">Loading the packing slip…</p>}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: { params: Promise<{ shopId: string; shopOrderId: string }> }) {
  await connection();
  const { shopId, shopOrderId } = await params;
  const access = await guardPage(`/seller/${shopId}/orders/${shopOrderId}/packing-slip`, () => requireShopRole(shopId, ["owner", "staff"]));
  const so = await shopOrderDetail({ shopId: access.shopId, role: access.role }, shopOrderId);
  if (!so) notFound();
  return <PackingSlip so={so} backHref={`/seller/${access.shopId}/orders/${so.id}`} />;
}

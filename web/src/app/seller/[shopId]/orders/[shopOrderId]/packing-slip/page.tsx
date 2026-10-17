import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { shopOrderDetail } from "@/features/orders/lifecycle/server";
import { PackingSlip } from "@/features/orders/lifecycle/ui/packing-slip";
import { guardPage } from "@/features/shops/page-guard";
import { requireShopRole } from "@/lib/auth";

export const metadata = { title: "Packing slip", robots: { index: false } };

/** Printable packing slip for one shop order (owner and staff of that shop). */
export default function PackingSlipPage({ params }: PageProps<"/seller/[shopId]/orders/[shopOrderId]/packing-slip">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 print:max-w-none print:p-0">
      <Suspense fallback={<p role="status">Loading the packing slip…</p>}>
        <Content params={params} />
      </Suspense>
    </main>
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

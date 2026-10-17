import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { payoutService } from "@/features/payouts/server";
import { ShopLedgerView } from "@/features/payouts/ui/shop-ledger";
import { guardPage } from "@/features/shops/page-guard";
import { requireShopRole } from "@/lib/auth";

export const metadata = { title: "Payouts" };

/** Seller centre (US-082): cash collections, due dates and payouts. Shop owner only (staff get "not found"). */
export default function ShopPayoutsPage({ params }: PageProps<"/seller/[shopId]/payouts">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Payouts</h1>
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: Promise<{ shopId: string }> }) {
  await connection();
  const { shopId } = await params;
  const access = await guardPage(`/seller/${shopId}/payouts`, () => requireShopRole(shopId, ["owner"]));
  return (
    <>
      <p className="text-sm">
        <Link className="text-blue-800 underline" href={`/seller/${access.shopId}`}>
          Back to the shop dashboard
        </Link>
      </p>
      <ShopLedgerView ledger={await payoutService.shopLedger(access.shopId)} />
    </>
  );
}

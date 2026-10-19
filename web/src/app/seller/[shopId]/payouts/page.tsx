import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { ListSkeleton } from "@/features/accounts/ui/auth-shell";
import { payoutService } from "@/features/payouts/server";
import { ShopLedgerView } from "@/features/payouts/ui/shop-ledger";
import { guardPage } from "@/features/shops/page-guard";
import { requireShopRole } from "@/lib/auth";

export const metadata = { title: "Payouts" };

/** Seller centre (US-082): cash collections, due dates and payouts. Shop owner only (staff get "not found"). */
export default function ShopPayoutsPage({ params }: PageProps<"/seller/[shopId]/payouts">) {
  return (
    <>
      <PageHeader title="Payouts" />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: Promise<{ shopId: string }> }) {
  await connection();
  const { shopId } = await params;
  const access = await guardPage(`/seller/${shopId}/payouts`, () => requireShopRole(shopId, ["owner"]));
  return <ShopLedgerView ledger={await payoutService.shopLedger(access.shopId)} />;
}

import { connection } from "next/server";
import { Suspense } from "react";
import { requireShopRole } from "@/lib/auth";
import { SellerDashboard } from "@/features/shops/components/seller-dashboard";
import { guardPage } from "@/features/shops/page-guard";

export default function ShopPage({ params }: PageProps<"/seller/[shopId]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-10">
      <Suspense fallback={<p>Loading…</p>}>
        <Dashboard params={params} />
      </Suspense>
    </main>
  );
}

async function Dashboard({ params }: { params: Promise<{ shopId: string }> }) {
  await connection();
  const { shopId } = await params;
  const access = await guardPage(`/seller/${shopId}`, () => requireShopRole(shopId, ["owner", "staff"]));
  return <SellerDashboard shopId={access.shopId} role={access.role} />;
}

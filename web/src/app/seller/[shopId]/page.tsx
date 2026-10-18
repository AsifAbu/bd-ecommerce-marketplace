import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { complaintsOfShop } from "@/features/complaints/server";
import { ScorePanel } from "@/features/metrics/ui/score-panel";
import { shopOrderList } from "@/features/orders/lifecycle/server";
import { lowStockOf } from "@/features/products/low-stock";
import { returnsOfShop } from "@/features/returns/server";
import { NeedsAttention } from "@/features/shops/components/needs-attention";
import { SellerDashboard } from "@/features/shops/components/seller-dashboard";
import { guardPage } from "@/features/shops/page-guard";
import { requireShopRole } from "@/lib/auth";

export const metadata = { title: "Shop dashboard" };

export default function ShopPage({ params }: PageProps<"/seller/[shopId]">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard params={params} />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-24 w-full max-w-3xl" />
      <Skeleton className="h-40 w-full max-w-2xl" />
    </div>
  );
}

async function Dashboard({ params }: { params: Promise<{ shopId: string }> }) {
  await connection();
  const { shopId } = await params;
  const access = await guardPage(`/seller/${shopId}`, () => requireShopRole(shopId, ["owner", "staff"]));
  // Everything below is read-only and scoped to the guard-checked shop.
  const [{ orders }, requested, tickets, lowStock] = await Promise.all([
    shopOrderList(access.shopId, { overdue: false }),
    returnsOfShop(access.shopId, "requested"),
    complaintsOfShop(access.shopId),
    lowStockOf(access.shopId),
  ]);
  const waitingOrders = orders.filter((o) => o.countdown.state !== null).sort((a, b) => a.handoverDueAt.localeCompare(b.handoverDueAt));
  const openTickets = tickets.filter((t) => t.active).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  return (
    <>
      <SellerDashboard
        shopId={access.shopId}
        role={access.role}
        attention={<NeedsAttention shopId={access.shopId} orders={waitingOrders} returns={requested} complaints={openTickets} lowStock={lowStock} />}
      />
      <ScorePanel shopId={access.shopId} />
    </>
  );
}

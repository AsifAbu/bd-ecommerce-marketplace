import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { handoverRate, pageFilters, shopOrderList } from "@/features/orders/lifecycle/server";
import { HANDOVER_RATE_TARGET } from "@/features/orders/lifecycle";
import { ShopOrderList } from "@/features/orders/lifecycle/ui/shop-order-list";
import { guardPage } from "@/features/shops/page-guard";
import { requirePlatformAdmin } from "@/lib/auth";

export const metadata = { title: "Orders: admin" };

const DAY_MS = 24 * 3_600_000;

/** Admin (US-053): every shop's orders, overdue handovers first when filtered, and the 48 h handover rate. */
export default function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-bold">Orders: admin</h1>
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  await guardPage("/admin/orders", requirePlatformAdmin);
  const filters = pageFilters(await searchParams);
  const now = new Date();
  const [{ orders, overdueCount }, rate] = await Promise.all([
    shopOrderList(null, filters),
    handoverRate({ shopId: filters.shopId ?? null, from: new Date(now.getTime() - 30 * DAY_MS), to: now }, now),
  ]);
  const pct = (n: number) => `${(n * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
  return (
    <>
      <p className="text-sm">
        <Link className="text-blue-800 underline" href="/admin/payouts">
          Payouts and COD collections
        </Link>
        {" · "}
        <Link className="text-blue-800 underline" href="/admin/metrics">
          Marketplace metrics
        </Link>
      </p>
      <section aria-labelledby="rate-heading" className="rounded border border-gray-300 p-4">
        <h2 id="rate-heading" className="font-semibold">
          Handed over within 48 h (last 30 days)
        </h2>
        <p data-testid="handover-rate">
          {rate.rate === null ? (
            "No shop order has reached its deadline yet."
          ) : (
            <>
              <strong className={rate.rate >= HANDOVER_RATE_TARGET ? "text-green-800" : "text-red-800"}>{pct(rate.rate)}</strong> ({rate.onTime} of {rate.eligible}; target{" "}
              {pct(HANDOVER_RATE_TARGET)} or more). {rate.pending} still inside their 48 h.
            </>
          )}
        </p>
      </section>
      <ShopOrderList orders={orders} basePath="/admin/orders" filters={filters} overdueCount={overdueCount} showShop />
    </>
  );
}

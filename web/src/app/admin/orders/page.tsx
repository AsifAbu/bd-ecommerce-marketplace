import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/loading";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge, buttonStyles } from "@/components/ui";
import { handoverRate, pageFilters, shopOrderList } from "@/features/orders/lifecycle/server";
import { HANDOVER_RATE_TARGET } from "@/features/orders/lifecycle";
import { AdminOrderList } from "@/features/orders/lifecycle/ui/admin-order-list";
import { guardPage } from "@/features/shops/page-guard";
import { requirePlatformAdmin } from "@/lib/auth";

export const metadata = { title: "Orders: admin" };

const DAY_MS = 24 * 3_600_000;

/** Admin (US-053): every shop's orders, overdue handovers first when filtered, and the 48 h handover rate. */
export default function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <>
      <AdminPageHeader
        title="Orders"
        description="Every shop's orders. A shop must hand an order to the courier within 48 hours."
        action={
          <Link className={buttonStyles({ variant: "secondary" })} href="/admin/payouts">
            Payouts and COD collections
          </Link>
        }
      />
      <Suspense fallback={<AdminLoading />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
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
      <section aria-labelledby="rate-heading" className="flex flex-col gap-2 rounded-lg bg-surface p-4 sm:p-5">
        <h2 id="rate-heading" className="text-sm font-medium text-muted">
          Handed over within 48 h, last 30 days
        </h2>
        <p data-testid="handover-rate" className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {rate.rate === null ? (
            "No shop order has reached its deadline yet."
          ) : (
            <>
              <strong className="text-2xl font-semibold tabular">{pct(rate.rate)}</strong>
              <Badge tone={rate.rate >= HANDOVER_RATE_TARGET ? "brand" : "sale"}>{rate.rate >= HANDOVER_RATE_TARGET ? "Target met" : "Below target"}</Badge>
              <span className="text-sm text-muted">
                {rate.onTime} of {rate.eligible} on time; target {pct(HANDOVER_RATE_TARGET)} or more. {rate.pending} still inside their 48 h.
              </span>
            </>
          )}
        </p>
      </section>
      <AdminOrderList orders={orders} basePath="/admin/orders" filters={filters} overdueCount={overdueCount} />
    </>
  );
}

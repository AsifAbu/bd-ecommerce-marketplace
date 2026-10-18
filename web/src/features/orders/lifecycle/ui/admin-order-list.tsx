import Link from "next/link";
import { EmptyState, FilterChips, type ChipItem } from "@/components/ui";
import { STATUS_LABELS, type ShopOrderStatus } from "../../config";
import { formatAddress, formatDhakaTime, formatTk } from "../../views";
import { ALL_STATUSES, type ShopOrderListView } from "../views";
import { HandoverDeadline, OverdueBadge, StatusBadge } from "./badges";

interface Filters {
  status?: ShopOrderStatus;
  overdue: boolean;
  shopId?: string;
}

function hrefFor(basePath: string, f: Filters, change: Partial<Filters>): string {
  const next = { ...f, ...change };
  const q = new URLSearchParams();
  if (next.status) q.set("status", next.status);
  if (next.overdue) q.set("overdue", "1");
  if (next.shopId) q.set("shopId", next.shopId);
  const s = q.toString();
  return s ? `${basePath}?${s}` : basePath;
}

/**
 * Admin view of every shop's orders: filter chips (status, past the 48 h handover deadline) and one
 * row per shop order. Overdue rows are tinted and say "Overdue" in words. Same list semantics as the
 * seller list (a list named "Shop orders", each item named "Shop order <no>").
 */
export function AdminOrderList({ orders, basePath, filters, overdueCount }: { orders: ShopOrderListView[]; basePath: string; filters: Filters; overdueCount: number }) {
  const statusItems: ChipItem[] = [
    { label: "All statuses", href: hrefFor(basePath, filters, { status: undefined }), current: !filters.status },
    ...ALL_STATUSES.map((s) => ({ label: STATUS_LABELS[s], href: hrefFor(basePath, filters, { status: s }), current: filters.status === s })),
  ];
  const deadlineItems: ChipItem[] = [
    { label: "Any deadline", href: hrefFor(basePath, filters, { overdue: false }), current: !filters.overdue },
    { label: "Past the 48 h deadline", href: hrefFor(basePath, filters, { overdue: true }), current: filters.overdue, count: overdueCount },
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <FilterChips label="Order status" items={statusItems} />
        <FilterChips label="Handover deadline" items={deadlineItems} />
      </div>

      {orders.length === 0 ? (
        <EmptyState title="No orders match" description="Try another status, or clear the deadline filter." action={<Link className="font-medium text-jade underline-offset-4 hover:underline" href={basePath}>Show all orders</Link>} />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-line" aria-label="Shop orders">
          {orders.map((so) => (
            <li
              key={so.id}
              aria-label={`Shop order ${so.shopOrderNo}`}
              className={`grid gap-x-6 gap-y-3 border-t border-line p-4 first:border-t-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] ${so.overdue ? "bg-vermilion-soft/50" : ""}`}
            >
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="text-base font-semibold">
                  <Link className="text-jade underline-offset-4 hover:underline" href={`${basePath}/${so.id}`}>
                    {so.shopOrderNo}
                    <span className="sr-only">, open order</span>
                  </Link>
                </h2>
                <p className="text-sm">{so.shopName}</p>
                <p className="text-sm text-muted">Placed {formatDhakaTime(so.placedAt)}</p>
              </div>
              <div className="flex min-w-0 flex-col gap-1 text-sm">
                <p className="font-medium">{so.customerName}</p>
                <p className="text-muted">
                  {so.zone === "inside_dhaka" ? "Inside Dhaka" : "Outside Dhaka"}: {formatAddress(so.address)}
                </p>
                <p>{so.items.map((i) => `${i.quantity} × ${i.title}${i.variantLabel ? ` (${i.variantLabel})` : ""}`).join(", ")}</p>
              </div>
              <div className="flex min-w-0 flex-col items-start gap-2 md:col-span-2 xl:col-span-1">
                <div className="flex flex-wrap items-center gap-2">
                  {so.overdue && <OverdueBadge />}
                  <StatusBadge status={so.status} label={so.statusLabel} />
                </div>
                <p className="text-sm">
                  <strong className="tabular">{formatTk(so.total)}</strong> <span className="text-muted">to collect</span>
                </p>
                <HandoverDeadline so={so} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

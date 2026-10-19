import Link from "next/link";
import { cn, linkStyles } from "@/components/ui";
import { STATUS_LABELS, type ShopOrderStatus } from "../../config";
import { formatAddress, formatDhakaTime, formatTk } from "../../views";
import { ALL_STATUSES, type ShopOrderListView } from "../views";
import { HandoverDeadline, OverdueBadge, StatusBadge } from "./badges";

const CHIP_LABELS: Record<ShopOrderStatus, string> = {
  placed: "New",
  confirmed: "Confirmed",
  packed: "Packed",
  handed_over: "With courier",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refused: "Refused",
  returned: "Returned",
};

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <li className="shrink-0">
      <Link
        href={href}
        aria-current={active ? "true" : undefined}
        className={cn(
          "pressable inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium",
          active ? "border-jade bg-jade-soft text-jade-hover" : "border-edge bg-paper text-ink hover:bg-surface",
        )}
      >
        {children}
      </Link>
    </li>
  );
}

/**
 * Shop orders with filters (status chips, overdue), the 48 h countdown and an Overdue badge. Used by
 * the seller centre (one shop, scoped by the guard) and the admin (every shop, with the shop name).
 */
export function ShopOrderList({
  orders,
  basePath,
  filters,
  overdueCount,
  showShop = false,
}: {
  orders: ShopOrderListView[];
  /** List URL; the detail is `${basePath}/${id}`. */
  basePath: string;
  filters: { status?: ShopOrderStatus; overdue: boolean; shopId?: string };
  overdueCount: number;
  showShop?: boolean;
}) {
  const href = (q: { status?: string; overdue?: boolean }) => {
    const params = new URLSearchParams();
    if (q.status) params.set("status", q.status);
    if (q.overdue) params.set("overdue", "1");
    if (filters.shopId) params.set("shopId", filters.shopId);
    const s = params.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const nothing = !filters.status && !filters.overdue;
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Filter orders" className="-mx-4 sm:-mx-6 lg:mx-0">
        <ul className="flex gap-2 overflow-x-auto px-4 pb-1 sm:px-6 lg:flex-wrap lg:overflow-visible lg:px-0">
          <Chip href={href({})} active={nothing}>
            All
          </Chip>
          <Chip href={href({ overdue: true })} active={filters.overdue}>
            Overdue{overdueCount > 0 ? ` (${overdueCount})` : ""}
          </Chip>
          {ALL_STATUSES.map((s) => (
            <Chip key={s} href={href({ status: s })} active={filters.status === s && !filters.overdue}>
              <span title={STATUS_LABELS[s]}>{CHIP_LABELS[s]}</span>
            </Chip>
          ))}
        </ul>
      </nav>

      <p className={cn("text-sm", overdueCount > 0 ? "font-medium text-vermilion" : "text-muted")}>
        {overdueCount > 0 ? (
          <Link className="underline underline-offset-4" href={href({ overdue: true })}>
            {overdueCount} {overdueCount === 1 ? "order is" : "orders are"} past the 48 h handover deadline
          </Link>
        ) : (
          "No order is past the 48 h handover deadline."
        )}
      </p>

      {orders.length === 0 ? (
        <p className="rounded-lg bg-surface p-6 text-muted">No orders match.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line" aria-label="Shop orders">
          {orders.map((so) => (
            <li key={so.id} className="flex flex-col gap-2.5 py-5" aria-label={`Shop order ${so.shopOrderNo}`}>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h2 className="text-base font-semibold">
                  <Link className="underline decoration-line underline-offset-4 hover:decoration-ink" href={`${basePath}/${so.id}`}>
                    {so.shopOrderNo}
                  </Link>
                  {showShop && <span className="font-normal text-muted">, {so.shopName}</span>}
                </h2>
                <span className="flex flex-wrap items-center gap-2">
                  {so.overdue && <OverdueBadge />}
                  <StatusBadge status={so.status} label={so.statusLabel} />
                </span>
              </div>
              <p className="min-w-0 break-words">
                {so.items.map((i) => `${i.quantity} × ${i.title}${i.variantLabel ? ` (${i.variantLabel})` : ""}`).join(", ")}
              </p>
              <p className="tabular font-semibold">
                {formatTk(so.total)} <span className="font-normal text-muted">to collect</span>
              </p>
              <p className="text-sm text-muted">
                Placed {formatDhakaTime(so.placedAt)} by {so.customerName}. {so.zone === "inside_dhaka" ? "Inside Dhaka" : "Outside Dhaka"}: {formatAddress(so.address)}
              </p>
              <HandoverDeadline so={so} />
              <p className="-ml-1 flex flex-wrap gap-x-4 text-sm">
                <Link className={cn(linkStyles, "inline-flex min-h-11 items-center px-1")} href={`${basePath}/${so.id}`}>
                  Open order<span className="sr-only"> {so.shopOrderNo}</span>
                </Link>
                {!showShop && (
                  <Link className={cn(linkStyles, "inline-flex min-h-11 items-center px-1")} href={`/orders/${so.orderNo}/invoice/${so.id}`}>
                    Print invoice<span className="sr-only"> for {so.shopOrderNo}</span>
                  </Link>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

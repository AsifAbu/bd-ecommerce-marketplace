import Link from "next/link";
import { buttonClass, inputClass } from "@/components/form-styles";
import { STATUS_LABELS, type ShopOrderStatus } from "../../config";
import { formatAddress, formatDhakaTime, formatTk } from "../../views";
import { ALL_STATUSES, type ShopOrderListView } from "../views";
import { HandoverDeadline, OverdueBadge, StatusBadge } from "./badges";

/**
 * Shop orders with filters (status, overdue), the 48 h countdown and an Overdue badge. Used by
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
  return (
    <div className="flex flex-col gap-4">
      <form method="get" action={basePath} className="flex flex-wrap items-end gap-3" aria-label="Filter orders">
        <div className="flex flex-col gap-1">
          <label htmlFor="order-status-filter" className="font-medium">
            Status
          </label>
          <select id="order-status-filter" name="status" defaultValue={filters.status ?? ""} className={inputClass}>
            <option value="">All statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        {filters.shopId && <input type="hidden" name="shopId" value={filters.shopId} />}
        <label className="flex items-center gap-2 pb-2">
          <input type="checkbox" name="overdue" value="1" defaultChecked={filters.overdue} />
          Only overdue (past 48 h)
        </label>
        <button type="submit" className={buttonClass}>
          Filter
        </button>
      </form>

      <p className="text-sm">
        {overdueCount > 0 ? (
          <Link className="font-semibold text-red-800 underline" href={`${basePath}?overdue=1`}>
            {overdueCount} {overdueCount === 1 ? "order is" : "orders are"} past the 48 h handover deadline
          </Link>
        ) : (
          "No order is past the 48 h handover deadline."
        )}
      </p>

      {orders.length === 0 ? (
        <p>No orders match.</p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Shop orders">
          {orders.map((so) => (
            <li key={so.id} className={`flex flex-col gap-2 rounded border p-4 ${so.overdue ? "border-red-700" : "border-gray-300"}`} aria-label={`Shop order ${so.shopOrderNo}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">
                  <Link className="text-blue-800 underline" href={`${basePath}/${so.id}`}>
                    {so.shopOrderNo}
                  </Link>
                  {showShop && <span className="font-normal"> · {so.shopName}</span>}
                </h2>
                <span className="flex gap-2">
                  {so.overdue && <OverdueBadge />}
                  <StatusBadge status={so.status} label={so.statusLabel} />
                </span>
              </div>
              <p className="text-sm">
                Placed {formatDhakaTime(so.placedAt)} · {so.customerName} · {so.zone === "inside_dhaka" ? "Inside Dhaka" : "Outside Dhaka"}: {formatAddress(so.address)}
              </p>
              <p className="text-sm">
                {so.items.map((i) => `${i.quantity} × ${i.title}${i.variantLabel ? ` (${i.variantLabel})` : ""}`).join(", ")} · <strong>{formatTk(so.total)}</strong> to collect
              </p>
              <HandoverDeadline so={so} />
              <p className="flex flex-wrap gap-4 text-sm">
                <Link className="text-blue-800 underline" href={`${basePath}/${so.id}`}>
                  Open order<span className="sr-only"> {so.shopOrderNo}</span>
                </Link>
                {!showShop && (
                  <Link className="text-blue-800 underline" href={`/orders/${so.orderNo}/invoice/${so.id}`}>
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

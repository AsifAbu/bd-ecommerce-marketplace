import Link from "next/link";
import { formatAddress, formatDhakaTime, formatTk } from "../../views";
import type { ShopOrderDetailView } from "../views";
import { HandoverDeadline, OverdueBadge, StatusBadge } from "./badges";
import { OrderActions, type ActionScope } from "./order-actions";
import { TimelineList } from "./timeline-list";

/** One shop order for the seller or the admin: status, deadline, customer, items, timeline and actions. */
export function ShopOrderDetail({ so, scope, backHref, packingSlipHref }: { so: ShopOrderDetailView; scope: ActionScope; backHref: string; packingSlipHref?: string }) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        <Link className="text-blue-800 underline" href={backHref}>
          Back to the orders
        </Link>
      </p>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Shop order {so.shopOrderNo}</h1>
          {so.overdue && <OverdueBadge />}
          <StatusBadge status={so.status} label={so.statusLabel} />
        </div>
        {scope.kind === "admin" && <p>{so.shopName}</p>}
        <HandoverDeadline so={so} />
        {so.courierName && (
          <p className="text-sm">
            Courier: <strong>{so.courierName}</strong>, tracking number <strong>{so.trackingNo}</strong>
          </p>
        )}
        {so.cancelReason && <p className="text-sm">Cancel reason: {so.cancelReason}</p>}
        {so.refusalNote && <p className="text-sm">Refusal note: {so.refusalNote}</p>}
      </header>

      <section aria-labelledby="actions-heading" className="flex flex-col gap-3 rounded border border-gray-300 p-4">
        <h2 id="actions-heading" className="text-lg font-semibold">
          Next step
        </h2>
        <OrderActions scope={scope} shopOrderId={so.id} shopOrderNo={so.shopOrderNo} actions={so.actions} />
      </section>

      <section aria-labelledby="customer-heading" className="flex flex-col gap-1">
        <h2 id="customer-heading" className="text-lg font-semibold">
          Deliver to
        </h2>
        <p>
          {so.address.name || so.customerName}, {so.customerPhone}
        </p>
        <p>
          {formatAddress(so.address)} ({so.zone === "inside_dhaka" ? "inside Dhaka" : "outside Dhaka"})
        </p>
        <p>Placed {formatDhakaTime(so.placedAt)}</p>
      </section>

      <section aria-labelledby="items-heading" className="flex flex-col gap-2">
        <h2 id="items-heading" className="text-lg font-semibold">
          Items
        </h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-300">
              <th scope="col" className="py-1">
                Item
              </th>
              <th scope="col" className="py-1">
                SKU
              </th>
              <th scope="col" className="py-1 text-right">
                Qty
              </th>
              <th scope="col" className="py-1 text-right">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {so.items.map((i) => (
              <tr key={i.id} className="border-b border-gray-100">
                <td className="py-1">
                  {i.title}
                  {i.variantLabel && <span className="text-gray-700"> ({i.variantLabel})</span>}
                </td>
                <td className="py-1">{i.sku ?? "—"}</td>
                <td className="py-1 text-right">{i.quantity}</td>
                <td className="py-1 text-right">{formatTk(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm">
          Items {formatTk(so.itemsSubtotal)} + delivery {so.freeDelivery ? "free" : formatTk(so.deliveryCharge)} = <strong>{formatTk(so.total)}</strong> to collect (cash on delivery)
        </p>
        <p className="flex flex-wrap gap-4 text-sm">
          {packingSlipHref && (
            <Link className="text-blue-800 underline" href={packingSlipHref}>
              Print packing slip
            </Link>
          )}
          {scope.kind === "shop" && (
            <Link className="text-blue-800 underline" href={`/orders/${so.orderNo}/invoice/${so.id}`}>
              Print invoice
            </Link>
          )}
        </p>
      </section>

      <section aria-labelledby="timeline-heading" className="flex flex-col gap-2">
        <h2 id="timeline-heading" className="text-lg font-semibold">
          Timeline
        </h2>
        <TimelineList entries={so.timeline} label={`Timeline of ${so.shopOrderNo}`} />
      </section>
    </div>
  );
}

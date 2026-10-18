import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui";
import { formatAddress, formatDhakaTime, formatTk } from "../../views";
import type { ShopOrderDetailView } from "../views";
import { HandoverDeadline, OverdueBadge, StatusBadge } from "./badges";
import { OrderActions, type ActionScope } from "./order-actions";
import { TimelineList } from "./timeline-list";

const link = "font-medium text-jade underline-offset-4 hover:underline";

/** One shop order for the seller or the admin: status, deadline, customer, items, timeline and actions. */
export function ShopOrderDetail({ so, scope, backHref, packingSlipHref }: { so: ShopOrderDetailView; scope: ActionScope; backHref: string; packingSlipHref?: string }) {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link className="-ml-1 inline-flex min-h-11 w-fit items-center gap-1 rounded-md px-1 text-sm text-muted hover:text-ink sm:min-h-9" href={backHref}>
          <ChevronLeft aria-hidden="true" size={16} />
          Back to the orders
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">Shop order {so.shopOrderNo}</h1>
          {so.overdue && <OverdueBadge />}
          <StatusBadge status={so.status} label={so.statusLabel} />
        </div>
        {scope.kind === "admin" && <p className="text-lg">{so.shopName}</p>}
        <HandoverDeadline so={so} />
        {so.courierName && (
          <p className="text-sm">
            Courier: <strong>{so.courierName}</strong>, tracking number <strong>{so.trackingNo}</strong>
          </p>
        )}
        {so.cancelReason && <p className="text-sm">Cancel reason: {so.cancelReason}</p>}
        {so.refusalNote && <p className="text-sm">Refusal note: {so.refusalNote}</p>}
      </header>

      <section aria-labelledby="actions-heading" className="flex flex-col gap-4 rounded-lg bg-surface p-4 sm:p-5">
        <h2 id="actions-heading" className="text-xl font-semibold">
          Next step
        </h2>
        <OrderActions scope={scope} shopOrderId={so.id} shopOrderNo={so.shopOrderNo} actions={so.actions} />
      </section>

      <section aria-labelledby="customer-heading" className="flex flex-col gap-1">
        <h2 id="customer-heading" className="mb-1 text-xl font-semibold">
          Deliver to
        </h2>
        <p>
          {so.address.name || so.customerName}, <span className="tabular">{so.customerPhone}</span>
        </p>
        <p>
          {formatAddress(so.address)} ({so.zone === "inside_dhaka" ? "inside Dhaka" : "outside Dhaka"})
        </p>
        <p className="text-sm text-muted">Placed {formatDhakaTime(so.placedAt)}</p>
      </section>

      <section aria-labelledby="items-heading" className="flex flex-col gap-3">
        <h2 id="items-heading" className="text-xl font-semibold">
          Items
        </h2>
        <Table caption="Items in this shop order">
          <Thead>
            <tr>
              <Th>Item</Th>
              <Th>SKU</Th>
              <Th align="right">Qty</Th>
              <Th align="right">Total</Th>
            </tr>
          </Thead>
          <Tbody>
            {so.items.map((i) => (
              <Tr key={i.id}>
                <Td>
                  {i.title}
                  {i.variantLabel && <span className="text-muted"> ({i.variantLabel})</span>}
                </Td>
                <Td>{i.sku ?? "—"}</Td>
                <Td align="right">{i.quantity}</Td>
                <Td align="right">{formatTk(i.lineTotal)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        <p className="text-sm">
          Items {formatTk(so.itemsSubtotal)} + delivery {so.freeDelivery ? "free" : formatTk(so.deliveryCharge)} = <strong>{formatTk(so.total)}</strong> to collect (cash on delivery)
        </p>
        <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {packingSlipHref && (
            <Link className={link} href={packingSlipHref}>
              Print packing slip
            </Link>
          )}
          {scope.kind === "shop" && (
            <Link className={link} href={`/orders/${so.orderNo}/invoice/${so.id}`}>
              Print invoice
            </Link>
          )}
        </p>
      </section>

      <section aria-labelledby="timeline-heading" className="flex flex-col gap-3">
        <h2 id="timeline-heading" className="text-xl font-semibold">
          Timeline
        </h2>
        <TimelineList entries={so.timeline} label={`Timeline of ${so.shopOrderNo}`} />
      </section>
    </div>
  );
}

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { buttonStyles, RowHeader, Section, Table, Td, Th, linkStyles } from "@/components/ui";
import { formatAddress, formatDhakaTime, formatTk } from "../../views";
import type { ShopOrderDetailView } from "../views";
import { HandoverDeadline, OverdueBadge, StatusBadge } from "./badges";
import { OrderActions, type ActionScope } from "./order-actions";
import { TimelineList } from "./timeline-list";

/** One shop order for the seller or the admin: status, deadline, customer, items, timeline and actions. */
export function ShopOrderDetail({ so, scope, backHref, packingSlipHref }: { so: ShopOrderDetailView; scope: ActionScope; backHref: string; packingSlipHref?: string }) {
  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <div className="flex flex-col gap-4">
        <Link className={`${linkStyles} -ml-1 inline-flex min-h-11 items-center gap-1 self-start px-1 text-sm`} href={backHref}>
          <ChevronLeft aria-hidden="true" size={16} />
          Back to the orders
        </Link>
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="text-3xl font-semibold">Shop order {so.shopOrderNo}</h1>
            <span className="flex flex-wrap items-center gap-2">
              {so.overdue && <OverdueBadge />}
              <StatusBadge status={so.status} label={so.statusLabel} />
            </span>
          </div>
          {scope.kind === "admin" && <p className="text-muted">{so.shopName}</p>}
          <HandoverDeadline so={so} />
          {so.courierName && (
            <p className="text-sm">
              Courier: <strong>{so.courierName}</strong>, tracking number <strong>{so.trackingNo}</strong>
            </p>
          )}
          {so.cancelReason && <p className="text-sm">Cancel reason: {so.cancelReason}</p>}
          {so.refusalNote && <p className="text-sm">Refusal note: {so.refusalNote}</p>}
        </header>
      </div>

      <Section title="Next step" level={2} className="rounded-lg bg-surface p-4 sm:p-5" id="actions-heading">
        <OrderActions scope={scope} shopOrderId={so.id} shopOrderNo={so.shopOrderNo} actions={so.actions} />
      </Section>

      <Section title="Deliver to">
        <div className="flex flex-col gap-0.5">
          <p className="font-medium">
            {so.address.name || so.customerName}, {so.customerPhone}
          </p>
          <p>
            {formatAddress(so.address)} ({so.zone === "inside_dhaka" ? "inside Dhaka" : "outside Dhaka"})
          </p>
          <p className="text-sm text-muted">Placed {formatDhakaTime(so.placedAt)}</p>
        </div>
      </Section>

      <Section title="Items">
        <Table label="Items in this order">
          <caption className="sr-only">Items in {so.shopOrderNo}</caption>
          <thead>
            <tr>
              <Th>Item</Th>
              <Th>SKU</Th>
              <Th className="text-right">Qty</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {so.items.map((i) => (
              <tr key={i.id}>
                <RowHeader className="min-w-40">
                  {i.title}
                  {i.variantLabel && <span className="font-normal text-muted"> ({i.variantLabel})</span>}
                </RowHeader>
                <Td className="whitespace-nowrap">{i.sku ?? "–"}</Td>
                <Td className="tabular text-right">{i.quantity}</Td>
                <Td className="tabular whitespace-nowrap text-right">{formatTk(i.lineTotal)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p>
          Items {formatTk(so.itemsSubtotal)} + delivery {so.freeDelivery ? "free" : formatTk(so.deliveryCharge)} = <strong>{formatTk(so.total)}</strong> to collect (cash on delivery)
        </p>
        <div className="flex flex-wrap gap-3">
          {packingSlipHref && (
            <Link className={buttonStyles({ variant: "secondary" })} href={packingSlipHref}>
              Print packing slip
            </Link>
          )}
          {scope.kind === "shop" && (
            <Link className={buttonStyles({ variant: "secondary" })} href={`/orders/${so.orderNo}/invoice/${so.id}`}>
              Print invoice
            </Link>
          )}
        </div>
      </Section>

      <Section title="Timeline">
        <TimelineList entries={so.timeline} label={`Timeline of ${so.shopOrderNo}`} />
      </Section>
    </div>
  );
}

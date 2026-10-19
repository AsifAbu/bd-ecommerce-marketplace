import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, buttonStyles, EmptyState, Notice, type BadgeTone } from "@/components/ui";
import { formatAddress, formatDhakaTime, formatTk, type OrderView, type ShopOrderView } from "../views";

/**
 * One customer order (confirmation, My orders detail, guest tracking): every shop order with its
 * status, items, delivery charge and total, a printable invoice per shop order, and the links to
 * request a return and report a problem (US-070, US-072). `itemExtras` adds content under an item by order
 * item id (the reviews feature's "Write a review", US-055).
 */

const STATUS_TONE: Record<string, BadgeTone> = {
  delivered: "brand",
  cancelled: "warning",
  refused: "warning",
  returned: "warning",
};

const quietLink = "inline-flex min-h-11 items-center font-medium text-jade underline-offset-4 hover:underline";

export function OrderDetail({
  order,
  placed,
  itemExtras,
  shopOrderExtra,
}: {
  order: OrderView;
  placed?: boolean;
  itemExtras?: Record<string, ReactNode>;
  /** Extra content per shop order (US-053 timeline and cancel; later returns and complaints). */
  shopOrderExtra?: (so: ShopOrderView) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-10">
      {placed && (
        <Notice tone="success" className="p-4">
          <p className="text-base font-semibold">Thank you! Your order {order.orderNo} is placed.</p>
          <p className="mt-0.5">
            We sent the confirmation by SMS{order.contactEmail ? " and the invoice by email" : ""}.{" "}
            {order.shopOrders.length > 1 ? `Your order is split into ${order.shopOrders.length} shop orders; each shop delivers its part.` : ""}
          </p>
        </Notice>
      )}

      <section aria-labelledby="order-summary-heading">
        <h2 id="order-summary-heading" className="sr-only">
          Order details
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm sm:text-base">
          <dt className="text-muted">Order number</dt>
          <dd>{order.orderNo}</dd>
          <dt className="text-muted">Placed</dt>
          <dd>{formatDhakaTime(order.placedAt)}</dd>
          <dt className="text-muted">Status</dt>
          <dd>{order.summaryStatus}</dd>
          <dt className="text-muted">Deliver to</dt>
          <dd>
            {order.address.name}, {order.address.phone.replace(/^\+88/, "")}: {formatAddress(order.address)}
          </dd>
          <dt className="text-muted">Payment</dt>
          <dd>Cash on delivery</dd>
        </dl>
      </section>

      {order.shopOrders.map((so) => (
        <ShopOrderCard key={so.id} orderNo={order.orderNo} shopOrder={so} itemExtras={itemExtras} extra={shopOrderExtra?.(so)} />
      ))}

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-lg bg-surface p-5" aria-label="Order total">
        <dt className="text-muted">Items</dt>
        <dd className="tabular text-right">{formatTk(order.itemsSubtotal)}</dd>
        <dt className="text-muted">Delivery charges</dt>
        <dd className="tabular text-right">{formatTk(order.deliveryTotal)}</dd>
        <dt className="text-lg font-semibold">Total (cash on delivery)</dt>
        <dd className="tabular text-right text-lg font-semibold">{formatTk(order.grandTotal)}</dd>
      </dl>
    </div>
  );
}

function ShopOrderCard({
  orderNo,
  shopOrder: so,
  itemExtras,
  extra,
}: {
  orderNo: string;
  shopOrder: ShopOrderView;
  itemExtras?: Record<string, ReactNode>;
  extra?: ReactNode;
}) {
  const headingId = `shop-order-${so.id}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={headingId} className="text-lg">
          Shop order {so.shopOrderNo}: {so.shopName}
        </h2>
        <Badge tone={STATUS_TONE[so.status] ?? "neutral"} data-testid="shop-order-status" className="px-2 py-1 text-sm">
          {so.statusLabel}
        </Badge>
      </div>
      <ul className="flex flex-col divide-y divide-line" aria-label={`Items from ${so.shopName}`}>
        {so.items.map((i) => (
          <li key={i.id} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0">
              <Link className="font-medium underline-offset-4 hover:underline" href={`/products/${encodeURIComponent(i.productId)}`}>
                {i.title}
              </Link>
              {i.variantLabel && <p className="text-sm text-muted">{i.variantLabel}</p>}
              <p className="tabular text-sm text-muted">
                {i.quantity} × {formatTk(i.unitPrice)}
              </p>
              {itemExtras?.[i.id]}
            </div>
            <p className="tabular shrink-0 font-medium">{formatTk(i.lineTotal)}</p>
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 border-t border-line pt-4 text-sm">
        <dt className="text-muted">Items</dt>
        <dd className="tabular text-right">{formatTk(so.itemsSubtotal)}</dd>
        <dt className="text-muted">Delivery charge</dt>
        <dd className="tabular text-right">{so.freeDelivery ? "Free" : formatTk(so.deliveryCharge)}</dd>
        <dt className="font-semibold">Shop order total</dt>
        <dd className="tabular text-right font-semibold">{formatTk(so.total)}</dd>
      </dl>
      {so.status === "placed" || so.status === "confirmed" || so.status === "packed" ? (
        <p className="text-sm text-muted">The shop hands it to the courier by {formatDhakaTime(so.handoverDueAt)}.</p>
      ) : null}
      {so.cancelReason && <p className="text-sm">Reason: {so.cancelReason}</p>}
      {extra}
      <div className="flex flex-wrap gap-x-5 text-sm">
        <Link className={quietLink} href={`/orders/${orderNo}/invoice/${so.id}`}>
          Print invoice
        </Link>
        {/* US-070 and US-072: returns (delivered shop orders, 7 days) and complaints, also for guests with the order open. */}
        {so.status === "delivered" && (
          <Link className={quietLink} href={`/orders/${orderNo}/return?shopOrder=${so.id}`}>
            Request a return<span className="sr-only"> from {so.shopOrderNo}</span>
          </Link>
        )}
        <Link className={quietLink} href={`/orders/${orderNo}/complaint?shopOrder=${so.id}`}>
          Report a problem<span className="sr-only"> with {so.shopOrderNo}</span>
        </Link>
      </div>
    </section>
  );
}

/** My orders (US-052): one row per customer order with each shop order's status. */
export function OrderList({ orders }: { orders: OrderView[] }) {
  if (orders.length === 0) {
    return (
      <EmptyState
        title="You have no orders yet"
        description="When you place an order it shows up here with its status."
        action={
          <Link className={buttonStyles()} href="/">
            Start shopping
          </Link>
        }
      />
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-line border-y border-line" aria-label="Your orders">
      {orders.map((o) => (
        <li key={o.id} className="flex flex-col gap-2 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <Link className="text-lg font-semibold underline-offset-4 hover:underline" href={`/orders/${o.orderNo}`}>
              {o.orderNo}
            </Link>
            <span className="tabular font-semibold">{formatTk(o.grandTotal)}</span>
          </div>
          <p className="text-sm text-muted">
            Placed {formatDhakaTime(o.placedAt)}. {o.summaryStatus}.
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {o.shopOrders.map((so) => (
              <li key={so.id}>
                {so.shopName}: <strong className="font-semibold">{so.statusLabel}</strong>{" "}
                <span className="text-muted">
                  ({so.items.reduce((n, i) => n + i.quantity, 0)} items, {formatTk(so.total)})
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

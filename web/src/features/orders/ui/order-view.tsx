import Link from "next/link";
import type { ReactNode } from "react";
import { formatAddress, formatDhakaTime, formatTk, type OrderView, type ShopOrderView } from "../views";

/**
 * One customer order (confirmation, My orders detail, guest tracking): every shop order with its
 * status, items, delivery charge and total, a printable invoice per shop order, and the places
 * reserved for returns and complaints (Sprint 7). `itemExtras` adds content under an item by order
 * item id (the reviews feature's "Write a review", US-055).
 */
export function OrderDetail({ order, placed, itemExtras }: { order: OrderView; placed?: boolean; itemExtras?: Record<string, ReactNode> }) {
  return (
    <div className="flex flex-col gap-6">
      {placed && (
        <div role="status" className="rounded border border-green-700 bg-green-50 p-4 text-green-900">
          <p className="font-semibold">Thank you! Your order {order.orderNo} is placed.</p>
          <p className="text-sm">
            We sent the confirmation by SMS{order.contactEmail ? " and the invoice by email" : ""}.{" "}
            {order.shopOrders.length > 1 ? `Your order is split into ${order.shopOrders.length} shop orders; each shop delivers its part.` : ""}
          </p>
        </div>
      )}

      <section aria-labelledby="order-summary-heading" className="flex flex-col gap-2">
        <h2 id="order-summary-heading" className="sr-only">
          Order details
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="font-medium">Order number</dt>
          <dd>{order.orderNo}</dd>
          <dt className="font-medium">Placed</dt>
          <dd>{formatDhakaTime(order.placedAt)}</dd>
          <dt className="font-medium">Status</dt>
          <dd>{order.summaryStatus}</dd>
          <dt className="font-medium">Deliver to</dt>
          <dd>
            {order.address.name}, {order.address.phone.replace(/^\+88/, "")}: {formatAddress(order.address)}
          </dd>
          <dt className="font-medium">Payment</dt>
          <dd>Cash on delivery</dd>
        </dl>
      </section>

      {order.shopOrders.map((so) => (
        <ShopOrderCard key={so.id} orderNo={order.orderNo} shopOrder={so} itemExtras={itemExtras} />
      ))}

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded border-2 border-gray-400 p-4" aria-label="Order total">
        <dt>Items</dt>
        <dd className="text-right">{formatTk(order.itemsSubtotal)}</dd>
        <dt>Delivery charges</dt>
        <dd className="text-right">{formatTk(order.deliveryTotal)}</dd>
        <dt className="text-lg font-bold">Total (cash on delivery)</dt>
        <dd className="text-right text-lg font-bold">{formatTk(order.grandTotal)}</dd>
      </dl>
    </div>
  );
}

function ShopOrderCard({
  orderNo,
  shopOrder: so,
  itemExtras,
}: {
  orderNo: string;
  shopOrder: ShopOrderView;
  itemExtras?: Record<string, ReactNode>;
}) {
  const headingId = `shop-order-${so.id}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded border border-gray-300 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="text-lg font-semibold">
          Shop order {so.shopOrderNo}: {so.shopName}
        </h2>
        <p>
          <span className="rounded bg-gray-100 px-2 py-0.5 text-sm font-semibold" data-testid="shop-order-status">
            {so.statusLabel}
          </span>
        </p>
      </div>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Items from {so.shopName}</caption>
        <thead>
          <tr className="border-b border-gray-300">
            <th scope="col" className="py-1">
              Item
            </th>
            <th scope="col" className="py-1 text-right">
              Qty
            </th>
            <th scope="col" className="py-1 text-right">
              Price
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
                <Link className="text-blue-800 underline" href={`/products/${encodeURIComponent(i.productId)}`}>
                  {i.title}
                </Link>
                {i.variantLabel && <span className="text-gray-700"> ({i.variantLabel})</span>}
                {itemExtras?.[i.id]}
              </td>
              <td className="py-1 text-right">{i.quantity}</td>
              <td className="py-1 text-right">{formatTk(i.unitPrice)}</td>
              <td className="py-1 text-right">{formatTk(i.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        <dt>Items</dt>
        <dd className="text-right">{formatTk(so.itemsSubtotal)}</dd>
        <dt>Delivery charge</dt>
        <dd className="text-right">{so.freeDelivery ? "Free" : formatTk(so.deliveryCharge)}</dd>
        <dt className="font-semibold">Shop order total</dt>
        <dd className="text-right font-semibold">{formatTk(so.total)}</dd>
      </dl>
      {so.status === "placed" || so.status === "confirmed" || so.status === "packed" ? (
        <p className="text-sm text-gray-800">The shop hands it to the courier by {formatDhakaTime(so.handoverDueAt)}.</p>
      ) : null}
      {so.cancelReason && <p className="text-sm">Reason: {so.cancelReason}</p>}
      <div className="flex flex-wrap gap-4 text-sm">
        <Link className="text-blue-800 underline" href={`/orders/${orderNo}/invoice/${so.id}`}>
          Print invoice
        </Link>
        {/* Sprint 7 (US-070, US-072): returns and complaints from the order page. */}
        <span className="text-gray-700" aria-disabled="true">
          Request a return (coming soon)
        </span>
        <span className="text-gray-700" aria-disabled="true">
          Raise a complaint (coming soon)
        </span>
      </div>
    </section>
  );
}

/** My orders (US-052): one row per customer order with each shop order's status. */
export function OrderList({ orders }: { orders: OrderView[] }) {
  if (orders.length === 0) {
    return (
      <p>
        You have no orders yet.{" "}
        <Link className="text-blue-800 underline" href="/">
          Start shopping
        </Link>
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-4" aria-label="Your orders">
      {orders.map((o) => (
        <li key={o.id} className="flex flex-col gap-2 rounded border border-gray-300 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Link className="text-lg font-semibold text-blue-800 underline" href={`/orders/${o.orderNo}`}>
              {o.orderNo}
            </Link>
            <span>{formatTk(o.grandTotal)}</span>
          </div>
          <p className="text-sm text-gray-800">
            Placed {formatDhakaTime(o.placedAt)} · {o.summaryStatus}
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {o.shopOrders.map((so) => (
              <li key={so.id}>
                {so.shopName}: <strong>{so.statusLabel}</strong> ({so.items.reduce((n, i) => n + i.quantity, 0)} items,{" "}
                {formatTk(so.total)})
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

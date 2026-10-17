import Link from "next/link";
import { STATUS_LABELS, type ShopOrderStatus } from "../config";
import { shopOrderNo } from "../order-no";
import type { SellerShopOrderRow } from "../repo";
import { formatAddress, formatDhakaTime, formatTk, toAddress } from "../views";

/**
 * Seller centre, Sprint 6 minimal: the shop's orders (scoped by shop, ADR-004) with status,
 * items, totals, the 48 h handover deadline and the invoice to print. Lifecycle actions
 * (confirm, pack, hand over, cancel) come in Sprint 7 (US-053).
 */
export function SellerOrders({ orders }: { orders: SellerShopOrderRow[] }) {
  if (orders.length === 0) return <p>No orders yet.</p>;
  return (
    <ul className="flex flex-col gap-4" aria-label="Shop orders">
      {orders.map((so) => {
        const no = shopOrderNo(so.order.orderNo, so.seq);
        const address = toAddress(so.order.address);
        return (
          <li key={so.id} className="flex flex-col gap-2 rounded border border-gray-300 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">{no}</h2>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-sm font-semibold">{STATUS_LABELS[so.status as ShopOrderStatus] ?? so.status}</span>
            </div>
            <p className="text-sm">
              Placed {formatDhakaTime(so.order.placedAt.toISOString())} · {so.order.contactName} ·{" "}
              {so.order.zone === "inside_dhaka" ? "Inside Dhaka" : "Outside Dhaka"}: {formatAddress(address)}
            </p>
            <ul className="text-sm">
              {so.items.map((i) => (
                <li key={i.id}>
                  {i.quantity} × {i.title}
                  {i.variantLabel ? ` (${i.variantLabel})` : ""}
                  {i.sku ? `, SKU ${i.sku}` : ""}: {formatTk(Number(i.lineTotal.toString()))}
                </li>
              ))}
            </ul>
            <p className="text-sm">
              Items {formatTk(Number(so.itemsSubtotal.toString()))} + delivery {formatTk(Number(so.deliveryCharge.toString()))} ={" "}
              <strong>{formatTk(Number(so.total.toString()))}</strong> to collect (cash on delivery)
            </p>
            {so.status === "placed" || so.status === "confirmed" || so.status === "packed" ? (
              <p className="text-sm font-semibold text-amber-900">Hand over by {formatDhakaTime(so.handoverDueAt.toISOString())}</p>
            ) : null}
            <p className="text-sm">
              <Link className="text-blue-800 underline" href={`/orders/${so.order.orderNo}/invoice/${so.id}`}>
                Print invoice
              </Link>
              <span className="sr-only"> for {no}</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}

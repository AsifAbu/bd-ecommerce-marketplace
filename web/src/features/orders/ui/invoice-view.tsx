import Link from "next/link";
import { formatAddress, formatDhakaTime, formatTk, type OrderView, type ShopOrderView } from "../views";
import { PrintButton } from "./print-button";

/**
 * Printable invoice for ONE shop order (Guidelines 2021: a printed bill showing VAT, and the
 * warranty for products that have one; one delivery charge per shop order). Shows the seller
 * and its registration, the customer and address, items with SKU and warranty, the VAT
 * contained in the prices, the delivery charge, the total and cash on delivery. The site header
 * and footer are hidden when printing (globals.css, [data-invoice]).
 */
export function InvoiceView({ order, shopOrder: so, platform }: { order: OrderView; shopOrder: ShopOrderView; platform: { name: string; dbid: string | null } }) {
  return (
    <article data-invoice className="flex flex-col gap-5 text-sm print:text-xs">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">Invoice</h1>
          <p>
            Invoice no. <strong>{so.shopOrderNo}</strong>
          </p>
          <p>Order {order.orderNo}</p>
          <p>Date: {formatDhakaTime(order.placedAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <PrintButton />
          <Link className="inline-flex min-h-11 items-center font-medium text-jade underline underline-offset-2" href={`/orders/${order.orderNo}`}>
            Back to the order
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section aria-labelledby="seller-heading">
          <h2 id="seller-heading" className="text-base">
            Seller
          </h2>
          <p>{so.shopName}</p>
          <p>{so.shopRegistration ?? "Basic seller (no trade registration on file)"}</p>
          <p className="text-muted print:text-black">
            Sold through {platform.name}
            {platform.dbid ? `, DBID ${platform.dbid}` : ""}
          </p>
        </section>
        <section aria-labelledby="customer-heading">
          <h2 id="customer-heading" className="text-base">
            Customer
          </h2>
          <p>{order.contactName}</p>
          <p>{order.contactPhone}</p>
          <p>
            Deliver to {order.address.name}, {order.address.phone.replace(/^\+88/, "")}
          </p>
          <p>{formatAddress(order.address)}</p>
        </section>
      </div>

      <div className="overflow-x-auto print:overflow-visible"><table className="w-full min-w-[34rem] text-left print:min-w-0">
        <caption className="sr-only">Items</caption>
        <thead>
          <tr className="border-b border-ink">
            <th scope="col" className="py-1">
              Item
            </th>
            <th scope="col" className="py-1">
              SKU
            </th>
            <th scope="col" className="py-1">
              Warranty
            </th>
            <th scope="col" className="py-1 text-right">
              Qty
            </th>
            <th scope="col" className="py-1 text-right">
              Unit price
            </th>
            <th scope="col" className="py-1 text-right">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {so.items.map((i) => (
            <tr key={i.id} className="border-b border-line">
              <td className="py-1">
                {i.title}
                {i.variantLabel && <span> ({i.variantLabel})</span>}
              </td>
              <td className="py-1">{i.sku ?? "–"}</td>
              <td className="py-1">{i.warranty ?? "No warranty"}</td>
              <td className="py-1 text-right">{i.quantity}</td>
              <td className="py-1 text-right">{formatTk(i.unitPrice)}</td>
              <td className="py-1 text-right">{formatTk(i.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>

      <dl className="ml-auto grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-4 gap-y-1" aria-label="Invoice total">
        <dt>Items</dt>
        <dd className="text-right">{formatTk(so.itemsSubtotal)}</dd>
        <dt>VAT ({so.vatRate}%, included in prices)</dt>
        <dd className="text-right">{formatTk(so.vatAmount)}</dd>
        <dt>Delivery charge</dt>
        <dd className="text-right">{so.freeDelivery ? "Free (Tk 0)" : formatTk(so.deliveryCharge)}</dd>
        <dt className="text-base font-semibold">Total</dt>
        <dd className="text-right text-base font-semibold">{formatTk(so.total)}</dd>
        <dt>Payment</dt>
        <dd className="text-right">Cash on delivery</dd>
      </dl>

      <p className="text-muted print:text-black">
        Keep this invoice for returns (7 days from delivery) and warranty claims. Delivery charge is for this shop order only; other shops in
        the same order send their own invoice.
      </p>
    </article>
  );
}

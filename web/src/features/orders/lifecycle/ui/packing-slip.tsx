import Link from "next/link";
import { formatAddress, formatDhakaTime, formatTk } from "../../views";
import type { ShopOrderDetailView } from "../views";
import { PrintSlipButton } from "./print-slip-button";

/**
 * Packing slip for one shop order (US-053): what goes in the parcel and where it goes, with the
 * cash the courier collects. No item prices (the invoice has them). The site header and footer
 * are hidden when printing ([data-invoice] print rule in globals.css).
 */
export function PackingSlip({ so, backHref }: { so: ShopOrderDetailView; backHref: string }) {
  return (
    <article data-invoice className="flex flex-col gap-5 text-sm print:text-xs">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Packing slip</h1>
          <p>
            Shop order <strong>{so.shopOrderNo}</strong>
          </p>
          <p>From: {so.shopName}</p>
          <p>Placed: {formatDhakaTime(so.placedAt)}</p>
        </div>
        <div className="flex gap-3 print:hidden">
          <PrintSlipButton />
          <Link className="self-center text-jade underline underline-offset-4" href={backHref}>
            Back to the order
          </Link>
        </div>
      </div>
      <section aria-labelledby="ship-to-heading">
        <h2 id="ship-to-heading" className="font-semibold">
          Ship to
        </h2>
        <p>{so.address.name || so.customerName}</p>
        <p>{so.customerPhone}</p>
        <p>{formatAddress(so.address)}</p>
      </section>
      <table className="w-full text-left">
        <caption className="sr-only">Items to pack</caption>
        <thead>
          <tr className="border-b border-gray-400">
            <th scope="col" className="py-1">
              Packed
            </th>
            <th scope="col" className="py-1">
              Item
            </th>
            <th scope="col" className="py-1">
              SKU
            </th>
            <th scope="col" className="py-1 text-right">
              Qty
            </th>
          </tr>
        </thead>
        <tbody>
          {so.items.map((i) => (
            <tr key={i.id} className="border-b border-gray-200">
              <td className="py-1" aria-hidden="true">
                ☐
              </td>
              <td className="py-1">
                {i.title}
                {i.variantLabel && ` (${i.variantLabel})`}
              </td>
              <td className="py-1">{i.sku ?? "—"}</td>
              <td className="py-1 text-right">{i.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Items: {so.itemCount} · Weight: {(so.weightGrams / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 })} kg
      </p>
      <p className="text-lg font-bold">Collect cash on delivery: {formatTk(so.total)}</p>
      {so.courierName && (
        <p>
          Courier: {so.courierName}, tracking number {so.trackingNo}
        </p>
      )}
    </article>
  );
}

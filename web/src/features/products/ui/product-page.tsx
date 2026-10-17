import Link from "next/link";
import type { ReactNode } from "react";
import { DEFAULT_DELIVERY_RATES, describeDelivery } from "@/lib/delivery";
import { formatDate, type ProductPage } from "../detail";
import { ProductGallery } from "./product-gallery";
import { PurchasePanel } from "./purchase-panel";
import { linkClass } from "./styles";

/**
 * Public product page (US-044): images, price and variants, delivery charge, return
 * eligibility, the seller, and the specs (guideline fields included).
 * `wishlist` is the wishlist button (wishlist feature); `notice` a message above the page.
 */
export function ProductDetailView({
  page,
  initialVariantId,
  wishlist,
  notice,
}: {
  page: ProductPage;
  initialVariantId: string | null;
  wishlist?: ReactNode;
  notice?: ReactNode;
}) {
  const rates = DEFAULT_DELIVERY_RATES;
  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap items-center gap-x-2">
          <li>
            <Link className={linkClass} href="/">
              Home
            </Link>
          </li>
          {page.breadcrumb.map((c, i) => (
            <li key={c.id} className="flex items-center gap-x-2">
              <span aria-hidden="true">›</span>
              <span aria-current={i === page.breadcrumb.length - 1 ? "location" : undefined}>{c.name}</span>
            </li>
          ))}
        </ol>
      </nav>

      {notice}

      <div className="grid gap-8 md:grid-cols-2">
        <ProductGallery title={page.title} images={page.images} />

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold">{page.title}</h1>
            <p className="flex flex-wrap items-center gap-2">
              <span>
                Sold by{" "}
                <Link className={linkClass} href={page.shop.href}>
                  {page.shop.name}
                </Link>
              </span>
              {page.shop.verified && <VerifiedBadge />}
            </p>
            {page.expiresOn && <p className="text-sm">Expiry date: {formatDate(page.expiresOn)}</p>}
          </div>

          <PurchasePanel
            key={`${page.id}:${initialVariantId ?? ""}`}
            axes={page.axes}
            variants={page.variants}
            initialVariantId={initialVariantId}
          >
            {wishlist}
          </PurchasePanel>

          <section aria-labelledby="delivery-heading" className="flex flex-col gap-2 rounded border border-gray-300 p-4">
            <h2 id="delivery-heading" className="text-lg font-semibold">
              Delivery charge
            </h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="font-medium">Inside Dhaka</dt>
              <dd>{describeDelivery(page.delivery.insideDhaka, rates)}</dd>
              <dt className="font-medium">Outside Dhaka</dt>
              <dd>{describeDelivery(page.delivery.outsideDhaka, rates)}</dd>
            </dl>
            <p className="text-sm text-gray-700">
              One charge per shop order: items from the same shop ship together. Tk {rates.extraPerKg} for each kg
              above {rates.includedGrams / 1000} kg. Pay cash on delivery.
            </p>
          </section>

          <section aria-labelledby="returns-heading" className="flex flex-col gap-2 rounded border border-gray-300 p-4">
            <h2 id="returns-heading" className="text-lg font-semibold">
              Returns
            </h2>
            <p>
              <strong>{page.returns.label}.</strong> {page.returns.text}
            </p>
          </section>
        </div>
      </div>

      <section aria-labelledby="description-heading" className="flex flex-col gap-2">
        <h2 id="description-heading" className="text-xl font-semibold">
          Description
        </h2>
        <p className="whitespace-pre-line">{page.description}</p>
      </section>

      <section aria-labelledby="specs-heading" className="flex flex-col gap-2">
        <h2 id="specs-heading" className="text-xl font-semibold">
          Specifications
        </h2>
        <table className="w-full max-w-2xl border-collapse text-left">
          <tbody>
            {page.specs.map((s) => (
              <tr key={s.key} className="border-b border-gray-200">
                <th scope="row" className="w-1/3 py-2 pr-4 align-top font-medium">
                  {s.label}
                </th>
                <td className="py-2">{s.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="seller-heading" className="flex flex-col gap-2 rounded border border-gray-300 p-4">
        <h2 id="seller-heading" className="text-xl font-semibold">
          About the seller
        </h2>
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{page.shop.name}</span>
          {page.shop.verified && <VerifiedBadge />}
        </p>
        <p>
          <Link className={linkClass} href={page.shop.href}>
            Visit the shop
          </Link>
        </p>
      </section>
    </div>
  );
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-green-700 bg-green-50 px-2 py-0.5 text-sm font-medium text-green-900">
      <span aria-hidden="true">✓</span> Verified seller
    </span>
  );
}

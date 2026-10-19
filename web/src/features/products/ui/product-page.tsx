import { BadgeCheck, ChevronDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Breadcrumbs } from "@/components/ui";
import { TIER_LABELS, tierOf } from "@/features/metrics";
import { DEFAULT_DELIVERY_RATES, describeDelivery } from "@/lib/delivery";
import { formatDate, type ProductPage } from "../detail";
import { ProductGallery } from "./product-gallery";
import { PurchasePanel } from "./purchase-panel";

/**
 * Public product page (US-044): images, price and variants, delivery charge, return
 * eligibility, the seller, and the specs (guideline fields included).
 * `cart` is the add-to-cart control (cart feature), `wishlist` the wishlist button (wishlist
 * feature); `notice` a message above the page; `rating` the rating under the title and
 * `reviews` the ratings and reviews section (reviews feature, US-055). `actionsExtra` is a free
 * slot beside the wishlist button, kept for a later "Try on" action on apparel.
 */
export function ProductDetailView({
  page,
  initialVariantId,
  cart,
  wishlist,
  actionsExtra,
  notice,
  rating,
  reviews,
}: {
  page: ProductPage;
  initialVariantId: string | null;
  cart?: ReactNode;
  wishlist?: ReactNode;
  actionsExtra?: ReactNode;
  notice?: ReactNode;
  rating?: ReactNode;
  reviews?: ReactNode;
}) {
  const rates = DEFAULT_DELIVERY_RATES;
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, ...page.breadcrumb.map((c) => ({ label: c.name }))]} />
        {notice}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <ProductGallery title={page.title} images={page.images} />
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl sm:text-3xl">{page.title}</h1>
            {rating}
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span>
                Sold by{" "}
                <Link className="tap font-medium text-jade underline-offset-4 hover:underline" href={page.shop.href}>
                  {page.shop.name}
                </Link>
              </span>
              {page.shop.verified && <VerifiedBadge />}
              <SellerScore score={page.shop.score} testId="product-seller-score" />
            </p>
            {page.expiresOn && <p className="text-sm text-muted">Expiry date: {formatDate(page.expiresOn)}</p>}
          </div>

          <PurchasePanel
            key={`${page.id}:${initialVariantId ?? ""}`}
            axes={page.axes}
            variants={page.variants}
            initialVariantId={initialVariantId}
            cart={cart}
            extra={actionsExtra}
          >
            {wishlist}
          </PurchasePanel>

          <section aria-labelledby="delivery-heading" className="flex flex-col gap-3">
            <h2 id="delivery-heading" className="text-base">
              Delivery and returns
            </h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted">Inside Dhaka</dt>
              <dd>{describeDelivery(page.delivery.insideDhaka, rates)}</dd>
              <dt className="text-muted">Outside Dhaka</dt>
              <dd>{describeDelivery(page.delivery.outsideDhaka, rates)}</dd>
              <dt className="text-muted">Returns</dt>
              <dd id="returns-info">
                <strong className="font-semibold">{page.returns.label}.</strong> {page.returns.text}
              </dd>
            </dl>
            <details className="disclosure text-sm">
              <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1 font-medium text-jade">
                How delivery is charged
                <ChevronDown aria-hidden="true" size={16} className="disclosure-chevron" />
              </summary>
              <p className="max-w-prose pb-2 text-muted">
                One charge per shop order: items from the same shop ship together. Tk {rates.extraPerKg} for each kg above{" "}
                {rates.includedGrams / 1000} kg. Pay cash on delivery.
              </p>
            </details>
          </section>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12">
        <section aria-labelledby="description-heading" className="flex flex-col gap-3">
          <h2 id="description-heading" className="text-xl">
            Description
          </h2>
          <p className="max-w-prose whitespace-pre-line">{page.description}</p>
        </section>

        <section aria-labelledby="specs-heading" className="flex flex-col gap-3">
          <h2 id="specs-heading" className="text-xl">
            Specifications
          </h2>
          <table className="w-full border-collapse text-left text-sm">
            <tbody>
              {page.specs.map((s) => (
                <tr key={s.key} className="border-b border-line">
                  <th scope="row" className="w-2/5 py-2.5 pr-4 text-left align-top font-normal text-muted">
                    {s.label}
                  </th>
                  <td className="py-2.5">{s.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {reviews}

      <section aria-labelledby="seller-heading" className="flex flex-col gap-2">
        <h2 id="seller-heading" className="text-xl">
          About the seller
        </h2>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold">{page.shop.name}</span>
          {page.shop.verified && <VerifiedBadge />}
          <SellerScore score={page.shop.score} testId="about-seller-score" />
        </p>
        <p>
          <Link className="tap font-medium text-jade underline-offset-4 hover:underline" href={page.shop.href}>
            Visit the shop
          </Link>
        </p>
      </section>
    </div>
  );
}

function VerifiedBadge() {
  return (
    <Badge tone="brand">
      <BadgeCheck aria-hidden="true" size={14} />
      Verified seller
    </Badge>
  );
}

/** The seller's score as plain text: "Seller score 88/100, Excellent", or "New seller" before the first score. */
function SellerScore({ score, testId }: { score: number | null; testId: string }) {
  const tier = tierOf(score);
  return (
    <span data-testid={testId} className="text-sm text-muted">
      {score === null ? TIER_LABELS.new : `Seller score ${score}/100, ${TIER_LABELS[tier]}`}
    </span>
  );
}

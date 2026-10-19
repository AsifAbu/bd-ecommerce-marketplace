import Link from "next/link";
import { ActionForm, Field } from "@/components/action-form";
import { Pagination } from "@/components/ui";
import { replyToReview } from "../actions";
import type { Paged, RatingView, ShopReview } from "../service";
import { RatingSummary, ReviewItem } from "./product-reviews";
import { linkClass } from "./stars";

/** Seller centre (/seller/[shopId]/reviews): the shop's rating and reviews, with a public reply. */
export function SellerReviews({ shopId, rating, data }: { shopId: string; rating: RatingView; data: Paged<ShopReview> }) {
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Shop rating</h2>
        <RatingSummary rating={rating} />
        <p className="text-sm text-muted">
          Shop owners and staff can&apos;t review their own products, and only the platform can hide a review. You can reply publicly.
        </p>
      </div>
      {data.items.length === 0 && <p className="rounded-lg bg-surface p-6 text-muted">No reviews yet.</p>}
      {data.items.length > 0 && (
        <div className="flex flex-col divide-y divide-line border-y border-line">
          {data.items.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 py-5">
              <p className="text-sm">
                <Link className={linkClass} href={`/products/${encodeURIComponent(r.productId)}`}>
                  {r.productTitle}
                </Link>
              </p>
              <ReviewItem review={r} />
              <details className="text-sm">
                <summary className={`${linkClass} inline-flex min-h-11 cursor-pointer items-center`}>{r.reply ? "Change the reply" : "Reply"}</summary>
                <div className="details-panel pt-2">
                  <ActionForm action={replyToReview} submitLabel="Publish reply" label={`Reply to the review of ${r.productTitle}`}>
                    <input type="hidden" name="shopId" value={shopId} />
                    <input type="hidden" name="reviewId" value={r.id} />
                    <Field as="textarea" name="text" label="Reply" rows={3} defaultValue={r.reply?.text ?? ""} required />
                  </ActionForm>
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
      <Pagination page={data.page} totalPages={data.totalPages} hrefFor={(p) => `/seller/${shopId}/reviews?page=${p}`} />
    </div>
  );
}

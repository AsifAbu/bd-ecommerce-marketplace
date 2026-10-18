import Link from "next/link";
import { ActionForm, Field } from "@/components/action-form";
import { replyToReview } from "../actions";
import type { Paged, RatingView, ShopReview } from "../service";
import { RatingSummary, ReviewItem } from "./product-reviews";
import { linkClass } from "./stars";

/** Seller centre (/seller/[shopId]/reviews): the shop's rating and reviews, with a public reply. */
export function SellerReviews({ shopId, rating, data }: { shopId: string; rating: RatingView; data: Paged<ShopReview> }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Shop rating</h2>
        <RatingSummary rating={rating} />
        <p className="text-sm text-muted">
          Shop owners and staff can&apos;t review their own products, and only the platform can hide a review. You can reply publicly.
        </p>
      </div>
      {data.items.length === 0 && <p>No reviews yet.</p>}
      {data.items.map((r) => (
        <div key={r.id} className="flex flex-col gap-2">
          <p className="text-sm">
            <Link className={linkClass} href={`/products/${encodeURIComponent(r.productId)}`}>
              {r.productTitle}
            </Link>
          </p>
          <ReviewItem review={r} />
          <details className="text-sm">
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-jade underline decoration-jade/40 underline-offset-4">{r.reply ? "Change the reply" : "Reply"}</summary>
            <ActionForm action={replyToReview} submitLabel="Publish reply" label={`Reply to the review of ${r.productTitle}`}>
              <input type="hidden" name="shopId" value={shopId} />
              <input type="hidden" name="reviewId" value={r.id} />
              <Field as="textarea" name="text" label="Reply" rows={3} defaultValue={r.reply?.text ?? ""} required />
            </ActionForm>
          </details>
        </div>
      ))}
      {data.totalPages > 1 && (
        <nav aria-label="Pages" className="flex gap-4 text-sm">
          {data.page > 1 && (
            <Link className={linkClass} href={`/seller/${shopId}/reviews?page=${data.page - 1}`}>
              Newer
            </Link>
          )}
          <span>
            Page {data.page} of {data.totalPages}
          </span>
          {data.page < data.totalPages && (
            <Link className={linkClass} href={`/seller/${shopId}/reviews?page=${data.page + 1}`}>
              Older
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

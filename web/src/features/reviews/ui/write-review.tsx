import Link from "next/link";
import { EDIT_WINDOW_DAYS } from "../rules";
import type { AwaitingItem, OwnReview, WriteContext } from "../service";
import { ReviewForm } from "./review-form";
import { writeReviewPath } from "./item-review";
import { cardClass, formatDay, linkClass, Stars } from "./stars";

/** The write / edit page of one order item (/account/reviews/[orderItemId]). */
export function WriteReview({ context }: { context: WriteContext }) {
  const { item, review, mode, blocked } = context;
  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link className={linkClass} href={`/products/${encodeURIComponent(item.productId)}`}>
          {item.title}
        </Link>
        {item.variantLabel && <span className="text-gray-700"> ({item.variantLabel})</span>}
        <br />
        <span className="text-sm text-gray-700">
          From {item.shopName}, order{" "}
          <Link className={linkClass} href={`/orders/${encodeURIComponent(item.orderNo)}`}>
            {item.orderNo}
          </Link>
        </span>
      </p>
      {blocked && (
        <p role="alert" className="rounded border border-amber-700 bg-amber-50 p-3" data-testid="review-blocked">
          {blocked.message}
        </p>
      )}
      {review && mode === "locked" && <OwnReviewCard review={review} />}
      {mode === "edit" && review && (
        <p className="text-sm text-gray-800">You can edit your review until {formatDay(review.editableUntil)}. Reviews can&apos;t be deleted.</p>
      )}
      {mode === "create" && (
        <p className="text-sm text-gray-800">
          Your review appears on the product page with your first name and a &quot;Verified purchase&quot; label. You can edit it for{" "}
          {EDIT_WINDOW_DAYS} days; reviews can&apos;t be deleted.
        </p>
      )}
      {mode !== "locked" && <ReviewForm orderItemId={item.orderItemId} review={review ?? undefined} />}
    </div>
  );
}

function OwnReviewCard({ review }: { review: OwnReview }) {
  return (
    <article className={cardClass}>
      <div className="flex flex-wrap items-center gap-2">
        <Stars value={review.rating} />
        {review.title && <h2 className="font-semibold">{review.title}</h2>}
      </div>
      <p className="text-sm text-gray-800">
        Written {formatDay(review.createdAt)}
        {review.editedAt && `, edited ${formatDay(review.editedAt)}`}
      </p>
      {review.text && <p className="whitespace-pre-line">{review.text}</p>}
      {review.status === "hidden" ? (
        <p className="text-sm text-red-800">Hidden by the platform{review.hiddenReason ? `: ${review.hiddenReason}` : ""}</p>
      ) : (
        !review.canEdit && <p className="text-sm text-gray-700">The {EDIT_WINDOW_DAYS}-day edit period has ended.</p>
      )}
      {review.reply && (
        <p className="rounded bg-gray-100 p-2 text-sm">
          <span className="font-semibold">Reply from the shop:</span> {review.reply}
        </p>
      )}
    </article>
  );
}

/** My reviews: items waiting for a review, then the reviews written. */
export function MyReviews({ awaiting, reviews }: { awaiting: AwaitingItem[]; reviews: OwnReview[] }) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="awaiting-heading" className="flex flex-col gap-3">
        <h2 id="awaiting-heading" className="text-xl font-semibold">
          Waiting for your review ({awaiting.length})
        </h2>
        {awaiting.length === 0 ? (
          <p>Nothing to review right now. Delivered items appear here.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {awaiting.map((a) => (
              <li key={a.orderItemId} className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-gray-300 p-3">
                <span>
                  {a.title}
                  {a.variantLabel && <span className="text-gray-700"> ({a.variantLabel})</span>}
                  <span className="block text-sm text-gray-700">
                    {a.shopName} · order {a.orderNo}
                    {a.deliveredAt && ` · delivered ${formatDay(a.deliveredAt)}`}
                  </span>
                </span>
                <Link className={linkClass} href={writeReviewPath(a.orderItemId)}>
                  Write a review<span className="sr-only"> of {a.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="written-heading" className="flex flex-col gap-3">
        <h2 id="written-heading" className="text-xl font-semibold">
          Your reviews ({reviews.length})
        </h2>
        {reviews.length === 0 ? (
          <p>You haven&apos;t written any reviews yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reviews.map((r) => (
              <li key={r.id} className={cardClass}>
                <span className="flex flex-wrap items-center gap-2">
                  <Stars value={r.rating} />
                  <Link className={linkClass} href={`/products/${encodeURIComponent(r.productId)}`}>
                    {r.productTitle}
                  </Link>
                  {r.status === "hidden" && <span className="text-sm text-red-800">Hidden by the platform</span>}
                </span>
                {r.title && <span className="font-semibold">{r.title}</span>}
                {r.text && <span className="line-clamp-3 whitespace-pre-line">{r.text}</span>}
                <Link className={`text-sm ${linkClass}`} href={writeReviewPath(r.orderItemId)}>
                  {r.canEdit ? "Edit" : "View"}
                  <span className="sr-only"> your review of {r.productTitle}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

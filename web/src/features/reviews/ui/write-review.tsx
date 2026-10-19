import Link from "next/link";
import { Badge, buttonStyles, Notice } from "@/components/ui";
import { EDIT_WINDOW_DAYS } from "../rules";
import type { AwaitingItem, OwnReview, WriteContext } from "../service";
import { ReviewForm } from "./review-form";
import { writeReviewPath } from "./item-review";
import { cardClass, formatDay, linkClass, Stars } from "./stars";

/** The write / edit page of one order item (/account/reviews/[orderItemId]). */
export function WriteReview({ context }: { context: WriteContext }) {
  const { item, review, mode, blocked } = context;
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold">
          <Link className={linkClass} href={`/products/${encodeURIComponent(item.productId)}`}>
            {item.title}
          </Link>
          {item.variantLabel && <span className="font-normal text-muted"> ({item.variantLabel})</span>}
        </p>
        <p className="text-sm text-muted">
          From {item.shopName}, order{" "}
          <Link className={linkClass} href={`/orders/${encodeURIComponent(item.orderNo)}`}>
            {item.orderNo}
          </Link>
        </p>
      </div>
      {blocked && (
        <Notice tone="warning" role="alert" data-testid="review-blocked">
          {blocked.message}
        </Notice>
      )}
      {review && mode === "locked" && <OwnReviewCard review={review} />}
      {mode === "edit" && review && (
        <p className="text-sm text-muted">You can edit your review until {formatDay(review.editableUntil)}. Reviews can&apos;t be deleted.</p>
      )}
      {mode === "create" && (
        <p className="text-sm text-muted">
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
      <p className="text-sm text-muted">
        Written {formatDay(review.createdAt)}
        {review.editedAt && `, edited ${formatDay(review.editedAt)}`}
      </p>
      {review.text && <p className="whitespace-pre-line">{review.text}</p>}
      {review.status === "hidden" ? (
        <p className="text-sm font-medium text-vermilion">Hidden by the platform{review.hiddenReason ? `: ${review.hiddenReason}` : ""}</p>
      ) : (
        !review.canEdit && <p className="text-sm text-muted">The {EDIT_WINDOW_DAYS}-day edit period has ended.</p>
      )}
      {review.reply && (
        <p className="rounded-md bg-surface p-3 text-sm">
          <span className="font-semibold">Reply from the shop:</span> {review.reply}
        </p>
      )}
    </article>
  );
}

/** My reviews: items waiting for a review, then the reviews written. */
export function MyReviews({ awaiting, reviews }: { awaiting: AwaitingItem[]; reviews: OwnReview[] }) {
  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <section aria-labelledby="awaiting-heading" className="flex flex-col gap-3">
        <h2 id="awaiting-heading" className="text-xl font-semibold">
          Waiting for your review ({awaiting.length})
        </h2>
        {awaiting.length === 0 ? (
          <p className="text-muted">Nothing to review right now. Delivered items appear here.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {awaiting.map((a) => (
              <li key={a.orderItemId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <span className="block font-medium">
                    {a.title}
                    {a.variantLabel && <span className="font-normal text-muted"> ({a.variantLabel})</span>}
                  </span>
                  <span className="block text-sm text-muted">
                    {a.shopName}, order {a.orderNo}
                    {a.deliveredAt && `, delivered ${formatDay(a.deliveredAt)}`}
                  </span>
                </span>
                <Link className={buttonStyles({ variant: "secondary" })} href={writeReviewPath(a.orderItemId)}>
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
          <p className="text-muted">You haven&apos;t written any reviews yet.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {reviews.map((r) => (
              <li key={r.id} className="flex flex-col gap-1.5 py-4">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars value={r.rating} />
                  <Link className={`${linkClass} font-medium`} href={`/products/${encodeURIComponent(r.productId)}`}>
                    {r.productTitle}
                  </Link>
                  {r.status === "hidden" && <Badge tone="sale">Hidden by the platform</Badge>}
                </span>
                {r.title && <span className="font-semibold">{r.title}</span>}
                {r.text && <span className="line-clamp-3 whitespace-pre-line text-muted">{r.text}</span>}
                <Link className={`${linkClass} inline-flex min-h-11 items-center self-start text-sm`} href={writeReviewPath(r.orderItemId)}>
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

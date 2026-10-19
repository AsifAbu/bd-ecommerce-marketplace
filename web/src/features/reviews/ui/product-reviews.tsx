import Link from "next/link";
import type { ProductReviewsView, PublicReview, RatingView } from "../service";
import { formatDay, plural, Stars } from "./stars";

/**
 * Product page (US-055): the rating next to the title, and the reviews section with the rating
 * histogram and a page of visible reviews ("Verified purchase": every review comes from a
 * delivered order item). Hidden reviews never appear here.
 */

const quietLink = "inline-flex min-h-11 items-center font-medium text-jade underline-offset-4 hover:underline";

export function RatingSummary({ rating }: { rating: RatingView }) {
  if (rating.count === 0 || rating.average === null) {
    return (
      <p className="text-sm text-muted" data-testid="rating-summary">
        No reviews yet
      </p>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm" data-testid="rating-summary">
      <Stars value={rating.average} />
      <span className="tabular font-semibold">{rating.average.toFixed(1)}</span>
      <a className="text-jade underline-offset-4 hover:underline" href="#reviews-heading">
        {plural(rating.count, "review")}
      </a>
    </p>
  );
}

function Histogram({ rating }: { rating: RatingView }) {
  return (
    <table className="w-full max-w-sm text-sm">
      <caption className="sr-only">Reviews per star rating</caption>
      <tbody>
        {rating.histogram.map((h) => (
          <tr key={h.stars}>
            <th scope="row" className="w-16 py-0.5 pr-2 text-left font-normal text-muted">
              {plural(h.stars, "star")}
            </th>
            <td className="py-0.5">
              <div className="h-2 w-full rounded-sm bg-surface" aria-hidden="true">
                <div className="h-2 rounded-sm bg-gold" style={{ width: `${h.percent}%` }} />
              </div>
            </td>
            <td className="tabular w-20 py-0.5 pl-2 text-right">
              {h.count} <span className="sr-only">reviews,</span>
              <span className="text-muted">({h.percent}%)</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ReviewItem({ review, headingLevel = 3 }: { review: PublicReview; headingLevel?: 3 | 4 }) {
  const Heading = headingLevel === 3 ? "h3" : "h4";
  return (
    <article className="flex flex-col gap-1.5 border-b border-line pb-5" data-testid="review">
      <div className="flex flex-wrap items-center gap-2">
        <Stars value={review.rating} />
        {review.title && <Heading className="text-base">{review.title}</Heading>}
      </div>
      <p className="text-sm text-muted">
        {review.author}, {formatDay(review.createdAt)}
        {review.edited && ", edited"}
        {review.variantLabel && `, ${review.variantLabel}`}.{" "}
        <span className="font-medium text-jade">Verified purchase</span>
      </p>
      {review.text && <p className="max-w-prose whitespace-pre-line">{review.text}</p>}
      {review.reply && (
        <div className="mt-1 max-w-prose rounded-md bg-surface p-3 text-sm">
          <p className="font-semibold">Reply from the shop, {formatDay(review.reply.at)}</p>
          <p className="whitespace-pre-line">{review.reply.text}</p>
        </div>
      )}
    </article>
  );
}

/** `pageHref(n)` links to page n of the reviews (the product page keeps its own query). */
export function ProductReviews({ data, pageHref }: { data: ProductReviewsView; pageHref: (page: number) => string }) {
  return (
    <section aria-labelledby="reviews-heading" className="flex flex-col gap-5">
      <h2 id="reviews-heading" className="scroll-mt-24 text-xl">
        Ratings and reviews
      </h2>
      {data.rating.count === 0 || data.rating.average === null ? (
        <p className="max-w-prose text-muted">No reviews yet. Customers who received this product can review it from their orders.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
            <p className="flex flex-col gap-0.5">
              <span className="tabular text-4xl font-semibold">{data.rating.average.toFixed(1)}</span>
              <Stars value={data.rating.average} />
              <span className="text-sm text-muted">{plural(data.rating.count, "rating")}</span>
            </p>
            <Histogram rating={data.rating} />
          </div>
          <div className="flex flex-col gap-5">
            {data.reviews.map((r) => (
              <ReviewItem key={r.id} review={r} />
            ))}
          </div>
          {data.totalPages > 1 && (
            <nav aria-label="Review pages" className="flex flex-wrap items-center gap-x-5 text-sm">
              {data.page > 1 && (
                <Link className={quietLink} href={pageHref(data.page - 1)} scroll={false}>
                  Newer reviews
                </Link>
              )}
              <span className="text-muted">
                Page {data.page} of {data.totalPages}
              </span>
              {data.page < data.totalPages && (
                <Link className={quietLink} href={pageHref(data.page + 1)} scroll={false}>
                  Older reviews
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </section>
  );
}

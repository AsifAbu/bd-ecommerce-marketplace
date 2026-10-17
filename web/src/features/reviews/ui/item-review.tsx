import Link from "next/link";
import type { ItemReviewState } from "../service";
import { linkClass, Stars } from "./stars";

export const writeReviewPath = (orderItemId: string) => `/account/reviews/${encodeURIComponent(orderItemId)}`;

/** Under an order item (order page): "Write a review", the user's review, or why not. */
export function ItemReview({ orderItemId, state }: { orderItemId: string; state: ItemReviewState | undefined }) {
  if (!state || state.kind === "not_delivered") return null;
  if (state.kind === "shop_member") {
    return <span className="block text-xs text-gray-700">Shop members can&apos;t review their own shop&apos;s products</span>;
  }
  if (state.kind === "can_review") {
    return (
      <Link className={`block text-sm ${linkClass}`} href={writeReviewPath(orderItemId)}>
        Write a review
      </Link>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      <span>Your review:</span>
      <Stars value={state.rating} />
      {state.status === "hidden" && <span className="text-red-800">(hidden by the platform)</span>}
      <Link className={linkClass} href={writeReviewPath(orderItemId)}>
        {state.canEdit ? "Edit" : "View"}
        <span className="sr-only"> your review</span>
      </Link>
    </span>
  );
}

import { z } from "zod";
import { ReviewError } from "./errors";

/**
 * Review rules (US-055), pure. Guidelines 2021: customers can rate and review; sellers, their
 * staff and connected people may not; reviews can't be deleted. So:
 * - only the buyer of an order item (the order's account; a guest order once it is linked to the
 *   account, US-009) can review it, and only after its shop order was delivered;
 * - members of the shop that sold it (owner or staff) are blocked;
 * - one review per order item; the author can edit it for EDIT_WINDOW_DAYS days (the previous
 *   text is kept in the audit log), never delete it;
 * - a Platform Admin hides a review with a reason (audit log) and can unhide it, also with a reason.
 */

export const RATING_MIN = 1;
export const RATING_MAX = 5;
/** Decision R1: the author may edit for 30 days after writing the review. */
export const EDIT_WINDOW_DAYS = 30;
export const EDIT_WINDOW_MS = EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
export const TITLE_MAX = 100;
export const TEXT_MAX = 2000;
export const REASON_MIN = 5;
export const REASON_MAX = 500;
export const REPLY_MAX = 1000;
export const REVIEWS_PER_PAGE = 10;

/**
 * Shop order statuses whose items can be reviewed: delivered, and returned (it was delivered
 * first; a "not as described" return is exactly what other shoppers should read). Same list as
 * the orders feature's DELIVERED_STATUSES.
 */
export const REVIEWABLE_STATUSES = ["delivered", "returned"] as const;
export const isReviewableStatus = (status: string) => (REVIEWABLE_STATUSES as readonly string[]).includes(status);

export type ReviewStatus = "visible" | "hidden";

/** Trimmed text with runs of spaces and blank lines tidied (line breaks are kept). */
export function cleanText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const optionalText = (max: number, label: string) =>
  z.preprocess(
    (v) => (v === undefined || v === null ? "" : v),
    z
      .string({ error: `${label} must be text` })
      .transform(cleanText)
      .pipe(z.string().max(max, `${label} can be at most ${max} characters`)),
  );

const ratingField = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v),
  z
    .number({ error: "Choose a rating from 1 to 5 stars" })
    .int("Choose a rating from 1 to 5 stars")
    .min(RATING_MIN, "Choose a rating from 1 to 5 stars")
    .max(RATING_MAX, "Choose a rating from 1 to 5 stars"),
);

/** POST /api/reviews and the review form. Text and title are optional (a rating alone is fine). */
export const createReviewSchema = z.object({
  orderItemId: z.string({ error: "Choose the item to review" }).min(1, "Choose the item to review").max(64, "Unknown item"),
  rating: ratingField,
  title: optionalText(TITLE_MAX, "The title"),
  text: optionalText(TEXT_MAX, "The review"),
});

/** PATCH /api/reviews/[id]: any of rating, title, text. */
export const updateReviewSchema = z
  .object({
    rating: ratingField.optional(),
    title: optionalText(TITLE_MAX, "The title").optional(),
    text: optionalText(TEXT_MAX, "The review").optional(),
  })
  .refine((v) => v.rating !== undefined || v.title !== undefined || v.text !== undefined, {
    message: "Change the rating, title or text",
    path: ["rating"],
  });

export const reasonSchema = z.object({
  reason: z
    .string({ error: "Give a reason" })
    .transform(cleanText)
    .pipe(z.string().min(REASON_MIN, `Give a reason of at least ${REASON_MIN} characters`).max(REASON_MAX, `The reason can be at most ${REASON_MAX} characters`)),
});

export const replySchema = z.object({
  text: z
    .string({ error: "Write a reply" })
    .transform(cleanText)
    .pipe(z.string().min(1, "Write a reply").max(REPLY_MAX, `The reply can be at most ${REPLY_MAX} characters`)),
});

/** Parses input with a schema or throws a 422 ReviewError with per-field messages. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) fields[String(issue.path[0] ?? "form")] ??= issue.message;
  const keys = Object.keys(fields);
  throw new ReviewError(422, "VALIDATION", keys.length === 1 ? fields[keys[0]] : "Check the highlighted fields", fields);
}

// ---------- Eligibility ----------

/** What the rules need to know about an order item the user wants to review. */
export interface ItemFacts {
  orderItemId: string;
  productId: string;
  /** The shop that sold it (shop order) and the product's shop: the same today, both checked. */
  shopId: string;
  productShopId: string;
  /** The order's account (null for a guest order that is not linked yet). */
  orderUserId: string | null;
  shopOrderStatus: string;
  /** Id of the existing review of this item, if any. */
  reviewId: string | null;
}

export type Eligibility =
  | { ok: true }
  | { ok: false; status: 403 | 404 | 409; code: "NOT_FOUND" | "NOT_DELIVERED" | "SHOP_MEMBER" | "ALREADY_REVIEWED"; message: string };

export const MESSAGES = {
  NOT_FOUND: "Order item not found",
  NOT_DELIVERED: "You can review this item once it has been delivered",
  SHOP_MEMBER: "Shop owners and staff can't review products of their own shop",
  ALREADY_REVIEWED: "You have already reviewed this item. You can edit your review instead.",
} as const;

/** True when the user owns, or works for, one of the shops involved. */
export const isShopMember = (memberShopIds: ReadonlySet<string>, item: Pick<ItemFacts, "shopId" | "productShopId">) =>
  memberShopIds.has(item.shopId) || memberShopIds.has(item.productShopId);

/**
 * Can `userId` write a review of this item? `item` is null when it doesn't exist or isn't the
 * user's (the same 404 either way, so ids can't be probed). Shop membership comes before the
 * delivery check so a member is told why at once.
 */
export function reviewEligibility(item: ItemFacts | null, userId: string, memberShopIds: ReadonlySet<string>): Eligibility {
  if (!item || !item.orderUserId || item.orderUserId !== userId) return { ok: false, status: 404, code: "NOT_FOUND", message: MESSAGES.NOT_FOUND };
  if (isShopMember(memberShopIds, item)) return { ok: false, status: 403, code: "SHOP_MEMBER", message: MESSAGES.SHOP_MEMBER };
  if (!isReviewableStatus(item.shopOrderStatus)) return { ok: false, status: 409, code: "NOT_DELIVERED", message: MESSAGES.NOT_DELIVERED };
  if (item.reviewId) return { ok: false, status: 409, code: "ALREADY_REVIEWED", message: MESSAGES.ALREADY_REVIEWED };
  return { ok: true };
}

export function assertCanReview(item: ItemFacts | null, userId: string, memberShopIds: ReadonlySet<string>): asserts item is ItemFacts {
  const e = reviewEligibility(item, userId, memberShopIds);
  if (!e.ok) throw new ReviewError(e.status, e.code, e.message);
}

// ---------- Editing and moderation ----------

export interface ReviewFacts {
  id: string;
  userId: string;
  productId: string;
  shopId: string;
  status: ReviewStatus;
  createdAt: Date;
}

/** The last moment the author may edit the review. */
export const editableUntil = (createdAt: Date) => new Date(createdAt.getTime() + EDIT_WINDOW_MS);

/** True while the author may still edit (visible and inside the window). */
export function canEdit(review: Pick<ReviewFacts, "status" | "createdAt">, now: Date): boolean {
  return review.status === "visible" && now.getTime() <= editableUntil(review.createdAt).getTime();
}

/** The author edits their review: their own, visible, within the window, not a shop member now. */
export function assertCanEdit(review: ReviewFacts | null, userId: string, memberShopIds: ReadonlySet<string>, now: Date): asserts review is ReviewFacts {
  if (!review || review.userId !== userId) throw new ReviewError(404, "NOT_FOUND", "Review not found");
  if (memberShopIds.has(review.shopId)) throw new ReviewError(403, "SHOP_MEMBER", MESSAGES.SHOP_MEMBER);
  if (review.status === "hidden") throw new ReviewError(409, "REVIEW_HIDDEN", "This review was hidden by the platform and can't be edited");
  if (!canEdit(review, now)) {
    throw new ReviewError(409, "EDIT_WINDOW_CLOSED", `Reviews can be edited for ${EDIT_WINDOW_DAYS} days after they are written`);
  }
}

export function assertCanHide(review: ReviewFacts | null): asserts review is ReviewFacts {
  if (!review) throw new ReviewError(404, "NOT_FOUND", "Review not found");
  if (review.status === "hidden") throw new ReviewError(409, "ALREADY_HIDDEN", "This review is already hidden");
}

export function assertCanUnhide(review: ReviewFacts | null): asserts review is ReviewFacts {
  if (!review) throw new ReviewError(404, "NOT_FOUND", "Review not found");
  if (review.status !== "hidden") throw new ReviewError(409, "NOT_HIDDEN", "This review is not hidden");
}

/** Reviews are never deleted (Guidelines 2021): the answer to any delete request. */
export const notDeletable = () =>
  new ReviewError(405, "REVIEW_NOT_DELETABLE", `Reviews can't be deleted. You can edit yours for ${EDIT_WINDOW_DAYS} days; the platform hides reviews that break the rules.`);

// ---------- Aggregates ----------

export interface RatingSummary {
  count: number;
  /** Sum of the stars. */
  total: number;
  /** Average to 2 decimals; 0 when there are no reviews. */
  average: number;
  /** Count per star: index 0 is 1 star, index 4 is 5 stars. */
  stars: [number, number, number, number, number];
}

export const EMPTY_SUMMARY: RatingSummary = { count: 0, total: 0, average: 0, stars: [0, 0, 0, 0, 0] };

/** The aggregate of a list of star ratings (visible reviews only). */
export function summarize(ratings: readonly number[]): RatingSummary {
  const stars: RatingSummary["stars"] = [0, 0, 0, 0, 0];
  let total = 0;
  for (const r of ratings) {
    if (!Number.isInteger(r) || r < RATING_MIN || r > RATING_MAX) continue;
    stars[r - 1]++;
    total += r;
  }
  const count = stars.reduce((a, b) => a + b, 0);
  return { count, total, average: count ? Math.round((total / count) * 100) / 100 : 0, stars };
}

/** Combines product aggregates (a shop's rating = all visible reviews of its products). */
export function combine(parts: readonly Pick<RatingSummary, "count" | "total" | "stars">[]): RatingSummary {
  const stars: RatingSummary["stars"] = [0, 0, 0, 0, 0];
  let count = 0;
  let total = 0;
  for (const p of parts) {
    count += p.count;
    total += p.total;
    p.stars.forEach((n, i) => (stars[i] += n));
  }
  return { count, total, average: count ? Math.round((total / count) * 100) / 100 : 0, stars };
}

/** The rating shown to shoppers and used by search: the average to 1 decimal, null without reviews. */
export const displayRating = (s: Pick<RatingSummary, "count" | "average">): number | null =>
  s.count > 0 ? Math.round(s.average * 10) / 10 : null;

/** Name shown on a review: the first word of the name and the next word's initial ("Rahim K."). */
export function reviewerName(name: string | null | undefined): string {
  const words = (name ?? "")
    .replace(/\[[^\]]*\]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, ""))
    .filter(Boolean);
  if (words.length === 0) return "Customer";
  return words.length > 1 ? `${words[0]} ${words[1][0].toUpperCase()}.` : words[0];
}

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { REVIEWABLE_STATUSES, summarize, type ReviewStatus } from "./rules";

/**
 * Reviews data access (ADR-004 style). Customer functions take the logged-in `userId` first and
 * filter by it (an order item is the user's when its order belongs to the account); shop
 * functions take the guard-checked `shopId` first. Reviews are never deleted: there is no delete
 * here, and moderation only changes `status`. Every write that can change what shoppers see
 * rewrites the product's rating aggregate in the same transaction.
 */

type Tx = Prisma.TransactionClient;


/** The facts the rules need about an order item (null unless it is the user's). */
export function findItemForReview(userId: string, orderItemId: string) {
  return prisma.orderItem.findFirst({
    where: { id: orderItemId, shopOrder: { order: { userId } } },
    select: {
      id: true,
      productId: true,
      title: true,
      variantLabel: true,
      shopOrder: { select: { shopId: true, status: true, shopName: true, order: { select: { userId: true, orderNo: true } } } },
      product: { select: { shopId: true } },
      review: { select: { id: true } },
    },
  });
}
export type ItemRow = NonNullable<Awaited<ReturnType<typeof findItemForReview>>>;

const stateSelect = {
  id: true,
  productId: true,
  shopOrder: { select: { shopId: true, status: true } },
  product: { select: { shopId: true } },
  review: { select: { id: true, rating: true, status: true, hiddenReason: true, createdAt: true } },
} satisfies Prisma.OrderItemSelect;

/** The user's own items among these ids, with their review (order pages). */
export function findItemsForUser(userId: string, orderItemIds: string[]) {
  return prisma.orderItem.findMany({
    where: { id: { in: orderItemIds }, shopOrder: { order: { userId } } },
    select: stateSelect,
  });
}
export type ItemStateRow = Awaited<ReturnType<typeof findItemsForUser>>[number];

/** The user's delivered items without a review yet, newest delivery first (My reviews). */
export function itemsAwaitingReview(userId: string, take = 50) {
  return prisma.orderItem.findMany({
    where: { review: null, shopOrder: { status: { in: [...REVIEWABLE_STATUSES] }, order: { userId } } },
    select: {
      id: true,
      productId: true,
      title: true,
      variantLabel: true,
      shopOrder: { select: { shopId: true, shopName: true, deliveredAt: true, order: { select: { orderNo: true } } } },
      product: { select: { shopId: true } },
    },
    orderBy: [{ shopOrder: { deliveredAt: "desc" } }, { createdAt: "desc" }],
    take,
  });
}

/** Ids among `shopIds` of shops the user owns or works for (owner or staff). */
export async function memberShopIds(userId: string, shopIds: string[]): Promise<Set<string>> {
  if (shopIds.length === 0) return new Set();
  const [members, owned] = await Promise.all([
    prisma.shopMember.findMany({ where: { userId, shopId: { in: shopIds } }, select: { shopId: true } }),
    prisma.shop.findMany({ where: { ownerId: userId, id: { in: shopIds } }, select: { id: true } }),
  ]);
  return new Set([...members.map((m) => m.shopId), ...owned.map((s) => s.id)]);
}

const factsSelect = { id: true, userId: true, productId: true, shopId: true, status: true, createdAt: true } satisfies Prisma.ReviewSelect;

/** The user's own review (null for anyone else's). */
export function findOwnReview(userId: string, reviewId: string) {
  return prisma.review.findFirst({ where: { id: reviewId, userId }, select: { ...factsSelect, rating: true, title: true, text: true } });
}

/** Any review by id (admin moderation only: call after requirePlatformAdmin). */
export function adminFindReview(reviewId: string) {
  return prisma.review.findUnique({ where: { id: reviewId }, select: { ...factsSelect, hiddenReason: true } });
}

/** Rewrites the product's rating from its visible reviews. Locks the aggregate row first. */
async function recomputeRating(tx: Tx, productId: string, shopId: string) {
  // The upsert locks the row, so concurrent review writes for one product recount one at a time.
  await tx.productRating.upsert({ where: { productId }, create: { productId, shopId }, update: { shopId } });
  const rows = await tx.review.findMany({ where: { productId, status: "visible" }, select: { rating: true } });
  const s = summarize(rows.map((r) => r.rating));
  await tx.productRating.update({
    where: { productId },
    data: {
      count: s.count,
      total: s.total,
      average: s.average.toFixed(2),
      stars1: s.stars[0],
      stars2: s.stars[1],
      stars3: s.stars[2],
      stars4: s.stars[3],
      stars5: s.stars[4],
    },
  });
}

export interface NewReview {
  userId: string;
  orderItemId: string;
  productId: string;
  shopId: string;
  rating: number;
  title: string | null;
  text: string;
}

/** Creates the review and updates the product rating (one transaction). */
export function createReview(data: NewReview) {
  return prisma.$transaction(async (tx) => {
    const review = await tx.review.create({ data: { ...data, status: "visible" }, select: { id: true, createdAt: true } });
    await recomputeRating(tx, data.productId, data.shopId);
    return review;
  });
}

export interface ReviewChange {
  rating: number;
  title: string | null;
  text: string;
}

/**
 * The author's edit: only their own, still visible review. The previous version goes to the
 * audit log (reviews are never deleted, and an edit must not erase what was said). False when
 * nothing matched (not theirs, or hidden meanwhile).
 */
export function updateOwnReview(userId: string, reviewId: string, change: ReviewChange, previous: ReviewChange, at: Date): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.review.updateMany({ where: { id: reviewId, userId, status: "visible" }, data: { ...change, editedAt: at } });
    if (count === 0) return false;
    const row = await tx.review.findFirst({ where: { id: reviewId, userId }, select: { productId: true, shopId: true } });
    await tx.auditLog.create({
      data: { actorId: userId, action: "review.edited", entity: "review", entityId: reviewId, data: { previous: { ...previous }, at: at.toISOString() } },
    });
    if (row) await recomputeRating(tx, row.productId, row.shopId);
    return true;
  });
}

/**
 * Admin moderation: hide (with a reason) or unhide. Only changes a review that is still in `from`
 * (a double click can't log twice). Written to the audit log in the same transaction.
 */
export function setStatus(reviewId: string, from: ReviewStatus, actorId: string, reason: string, at: Date): Promise<boolean> {
  const to: ReviewStatus = from === "visible" ? "hidden" : "visible";
  return prisma.$transaction(async (tx) => {
    const before = await tx.review.findFirst({ where: { id: reviewId, status: from }, select: { productId: true, shopId: true, hiddenReason: true } });
    if (!before) return false;
    const data =
      to === "hidden"
        ? { status: to, hiddenReason: reason, hiddenById: actorId, hiddenAt: at }
        : { status: to, hiddenReason: null, hiddenById: null, hiddenAt: null };
    const { count } = await tx.review.updateMany({ where: { id: reviewId, status: from }, data });
    if (count === 0) return false;
    await tx.auditLog.create({
      data: {
        actorId,
        action: to === "hidden" ? "review.hidden" : "review.unhidden",
        entity: "review",
        entityId: reviewId,
        data: { reason, productId: before.productId, ...(to === "visible" ? { previousReason: before.hiddenReason } : {}) },
      },
    });
    await recomputeRating(tx, before.productId, before.shopId);
    return true;
  });
}

/** The shop's public reply to a review of its own product (scoped by the guard-checked shopId). */
export function setReply(shopId: string, reviewId: string, text: string, userId: string, at: Date): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.review.updateMany({ where: { id: reviewId, shopId, status: "visible" }, data: { replyText: text, replyById: userId, repliedAt: at } });
    if (count === 0) return false;
    await tx.auditLog.create({ data: { actorId: userId, action: "review.replied", entity: "review", entityId: reviewId, data: { shopId, text } } });
    return true;
  });
}

// ---------- Public reads (visible reviews only) ----------

export const ratingSelect = {
  count: true,
  total: true,
  average: true,
  stars1: true,
  stars2: true,
  stars3: true,
  stars4: true,
  stars5: true,
} satisfies Prisma.ProductRatingSelect;
export type RatingRow = Prisma.ProductRatingGetPayload<{ select: typeof ratingSelect }>;

export function getProductRating(productId: string): Promise<RatingRow | null> {
  return prisma.productRating.findUnique({ where: { productId }, select: ratingSelect });
}

const publicSelect = {
  id: true,
  rating: true,
  title: true,
  text: true,
  createdAt: true,
  editedAt: true,
  replyText: true,
  repliedAt: true,
  user: { select: { name: true } },
  orderItem: { select: { variantLabel: true } },
} satisfies Prisma.ReviewSelect;
export type PublicRow = Prisma.ReviewGetPayload<{ select: typeof publicSelect }>;

/** A product's visible reviews, newest first. */
export function listVisibleForProduct(productId: string, skip: number, take: number): Promise<PublicRow[]> {
  return prisma.review.findMany({
    where: { productId, status: "visible" },
    select: publicSelect,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip,
    take,
  });
}

export function countVisibleForProduct(productId: string): Promise<number> {
  return prisma.review.count({ where: { productId, status: "visible" } });
}

// ---------- The author ----------

const ownSelect = {
  id: true,
  orderItemId: true,
  productId: true,
  rating: true,
  title: true,
  text: true,
  status: true,
  hiddenReason: true,
  createdAt: true,
  editedAt: true,
  replyText: true,
  orderItem: { select: { title: true, variantLabel: true } },
} satisfies Prisma.ReviewSelect;
export type OwnRow = Prisma.ReviewGetPayload<{ select: typeof ownSelect }>;

export function listForUser(userId: string, take = 100): Promise<OwnRow[]> {
  return prisma.review.findMany({ where: { userId }, select: ownSelect, orderBy: { createdAt: "desc" }, take });
}

/** The user's review of an order item (the edit form). */
export function findOwnByItem(userId: string, orderItemId: string): Promise<OwnRow | null> {
  return prisma.review.findFirst({ where: { orderItemId, userId }, select: ownSelect });
}

// ---------- The shop (scoped by shopId) ----------

const shopSelect = { ...publicSelect, productId: true, product: { select: { title: true } } } satisfies Prisma.ReviewSelect;
export type ShopRow = Prisma.ReviewGetPayload<{ select: typeof shopSelect }>;

export function listForShop(shopId: string, skip: number, take: number): Promise<ShopRow[]> {
  return prisma.review.findMany({ where: { shopId, status: "visible" }, select: shopSelect, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip, take });
}

export function countForShop(shopId: string): Promise<number> {
  return prisma.review.count({ where: { shopId, status: "visible" } });
}

/** The product aggregates of one shop (its rating = all of them combined). */
export function shopRatingRows(shopId: string) {
  return prisma.productRating.findMany({ where: { shopId }, select: ratingSelect });
}

/** Star ratings of a shop's visible reviews written in [from, to) (a rolling-window score). */
export async function shopRatingsBetween(shopId: string, from: Date, to: Date): Promise<number[]> {
  const rows = await prisma.review.findMany({ where: { shopId, status: "visible", createdAt: { gte: from, lt: to } }, select: { rating: true } });
  return rows.map((r) => r.rating);
}

// ---------- Platform Admin ----------

const adminSelect = {
  id: true,
  productId: true,
  rating: true,
  title: true,
  text: true,
  status: true,
  hiddenReason: true,
  hiddenAt: true,
  createdAt: true,
  editedAt: true,
  product: { select: { title: true } },
  shop: { select: { name: true } },
  user: { select: { name: true, email: true } },
  hiddenBy: { select: { name: true, email: true } },
  orderItem: { select: { shopOrder: { select: { order: { select: { orderNo: true } } } } } },
} satisfies Prisma.ReviewSelect;
export type AdminRow = Prisma.ReviewGetPayload<{ select: typeof adminSelect }>;

/** The moderation queue: newest first (call after requirePlatformAdmin). */
export function adminList(status: ReviewStatus, skip: number, take: number): Promise<AdminRow[]> {
  return prisma.review.findMany({ where: { status }, select: adminSelect, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip, take });
}

export function adminCount(status: ReviewStatus): Promise<number> {
  return prisma.review.count({ where: { status } });
}

/** Reviews written in [from, to): status and stars (metrics, US-083). */
export function reviewsBetween(from: Date, to: Date) {
  return prisma.review.findMany({ where: { createdAt: { gte: from, lt: to } }, select: { rating: true, status: true } });
}

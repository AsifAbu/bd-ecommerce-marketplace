import { ReviewError } from "./errors";
import type { AdminRow, ItemRow, ItemStateRow, NewReview, OwnRow, PublicRow, RatingRow, ReviewChange, ShopRow } from "./repo";
import {
  assertCanEdit,
  assertCanHide,
  assertCanReview,
  assertCanUnhide,
  canEdit,
  combine,
  createReviewSchema,
  displayRating,
  editableUntil,
  EMPTY_SUMMARY,
  isReviewableStatus,
  isShopMember,
  parseInput,
  reasonSchema,
  replySchema,
  reviewerName,
  REVIEWS_PER_PAGE,
  summarize,
  updateReviewSchema,
  type ItemFacts,
  type RatingSummary,
  type ReviewFacts,
  type ReviewStatus,
} from "./rules";

/**
 * Review use cases (US-055) with injected dependencies. Callers pass guard-checked ids:
 * `userId` from requireUser(), `adminId` from requirePlatformAdmin(), `shopId` from
 * requireShopRole(). Every write that changes a product's rating tells search (re-index).
 */

export interface ReviewRepo {
  findItemForReview(userId: string, orderItemId: string): Promise<ItemRow | null>;
  findItemsForUser(userId: string, orderItemIds: string[]): Promise<ItemStateRow[]>;
  itemsAwaitingReview(userId: string, take?: number): Promise<AwaitingRow[]>;
  memberShopIds(userId: string, shopIds: string[]): Promise<Set<string>>;
  findOwnReview(userId: string, reviewId: string): Promise<(ReviewFacts & ReviewChange) | null>;
  adminFindReview(reviewId: string): Promise<(ReviewFacts & { hiddenReason: string | null }) | null>;
  createReview(data: NewReview): Promise<{ id: string; createdAt: Date }>;
  updateOwnReview(userId: string, reviewId: string, change: ReviewChange, previous: ReviewChange, at: Date): Promise<boolean>;
  setStatus(reviewId: string, from: ReviewStatus, actorId: string, reason: string, at: Date): Promise<boolean>;
  setReply(shopId: string, reviewId: string, text: string, userId: string, at: Date): Promise<boolean>;
  getProductRating(productId: string): Promise<RatingRow | null>;
  listVisibleForProduct(productId: string, skip: number, take: number): Promise<PublicRow[]>;
  countVisibleForProduct(productId: string): Promise<number>;
  listForUser(userId: string, take?: number): Promise<OwnRow[]>;
  findOwnByItem(userId: string, orderItemId: string): Promise<OwnRow | null>;
  listForShop(shopId: string, skip: number, take: number): Promise<ShopRow[]>;
  countForShop(shopId: string): Promise<number>;
  shopRatingRows(shopId: string): Promise<RatingRow[]>;
  shopRatingsBetween(shopId: string, from: Date, to: Date): Promise<number[]>;
  adminList(status: ReviewStatus, skip: number, take: number): Promise<AdminRow[]>;
  adminCount(status: ReviewStatus): Promise<number>;
  reviewsBetween(from: Date, to: Date): Promise<{ rating: number; status: ReviewStatus }[]>;
}

export interface AwaitingRow {
  id: string;
  productId: string;
  title: string;
  variantLabel: string | null;
  shopOrder: { shopId: string; shopName: string; deliveredAt: Date | null; order: { orderNo: string } };
  product: { shopId: string };
}

export interface ReviewDeps {
  repo: ReviewRepo;
  now: () => Date;
  /** Search re-index hook (the rating is in the search document). Must not throw. */
  onProductsChanged: (productIds: string[]) => void;
}

// ---------- Views ----------

export interface RatingView {
  count: number;
  /** Average to 1 decimal; null without reviews. */
  average: number | null;
  /** 5 stars first. */
  histogram: { stars: 1 | 2 | 3 | 4 | 5; count: number; percent: number }[];
}

export interface PublicReview {
  id: string;
  rating: number;
  title: string | null;
  text: string;
  author: string;
  /** Always true: every review comes from a delivered order item. */
  verifiedPurchase: true;
  variantLabel: string | null;
  createdAt: string;
  edited: boolean;
  reply: { text: string; at: string } | null;
}

export interface ProductReviewsView {
  rating: RatingView;
  reviews: PublicReview[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface OwnReview {
  id: string;
  orderItemId: string;
  productId: string;
  productTitle: string;
  variantLabel: string | null;
  rating: number;
  title: string | null;
  text: string;
  status: ReviewStatus;
  hiddenReason: string | null;
  createdAt: string;
  editedAt: string | null;
  editableUntil: string;
  canEdit: boolean;
  reply: string | null;
}

export type ItemReviewState =
  | { kind: "can_review" }
  | { kind: "reviewed"; reviewId: string; rating: number; status: ReviewStatus; hiddenReason: string | null; canEdit: boolean }
  | { kind: "shop_member" }
  | { kind: "not_delivered" };

export interface AwaitingItem {
  orderItemId: string;
  productId: string;
  title: string;
  variantLabel: string | null;
  shopName: string;
  orderNo: string;
  deliveredAt: string | null;
}

export interface WriteContext {
  item: { orderItemId: string; productId: string; title: string; variantLabel: string | null; shopName: string; orderNo: string };
  /** What the page should offer. */
  mode: "create" | "edit" | "locked";
  /** Why it can't be reviewed (mode "locked" without a review), or null. */
  blocked: { code: string; message: string } | null;
  review: OwnReview | null;
}

export interface ShopReview extends PublicReview {
  productId: string;
  productTitle: string;
}

export interface AdminReview {
  id: string;
  productId: string;
  productTitle: string;
  shopName: string;
  authorName: string;
  authorEmail: string | null;
  orderNo: string;
  rating: number;
  title: string | null;
  text: string;
  status: ReviewStatus;
  hiddenReason: string | null;
  hiddenAt: string | null;
  hiddenBy: string | null;
  createdAt: string;
  editedAt: string | null;
}

export interface Paged<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface ReviewMetrics {
  written: number;
  visible: number;
  hidden: number;
  /** Average stars of the visible reviews written in the range (1 decimal), null when none. */
  averageRating: number | null;
}

// ---------- Mapping ----------

export function ratingView(s: RatingSummary): RatingView {
  return {
    count: s.count,
    average: displayRating(s),
    histogram: ([5, 4, 3, 2, 1] as const).map((stars) => {
      const count = s.stars[stars - 1];
      return { stars, count, percent: s.count ? Math.round((count / s.count) * 100) : 0 };
    }),
  };
}

export function fromRatingRow(row: RatingRow | null): RatingSummary {
  if (!row) return EMPTY_SUMMARY;
  return {
    count: row.count,
    total: row.total,
    average: Number(row.average.toString()),
    stars: [row.stars1, row.stars2, row.stars3, row.stars4, row.stars5],
  };
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function toPublic(row: PublicRow): PublicReview {
  return {
    id: row.id,
    rating: row.rating,
    title: row.title,
    text: row.text,
    author: reviewerName(row.user.name),
    verifiedPurchase: true,
    variantLabel: row.orderItem.variantLabel,
    createdAt: row.createdAt.toISOString(),
    edited: row.editedAt !== null,
    reply: row.replyText && row.repliedAt ? { text: row.replyText, at: row.repliedAt.toISOString() } : null,
  };
}

function toOwn(row: OwnRow, now: Date): OwnReview {
  return {
    id: row.id,
    orderItemId: row.orderItemId,
    productId: row.productId,
    productTitle: row.orderItem.title,
    variantLabel: row.orderItem.variantLabel,
    rating: row.rating,
    title: row.title,
    text: row.text,
    status: row.status,
    hiddenReason: row.hiddenReason,
    createdAt: row.createdAt.toISOString(),
    editedAt: iso(row.editedAt),
    editableUntil: editableUntil(row.createdAt).toISOString(),
    canEdit: canEdit(row, now),
    reply: row.replyText,
  };
}

function toAdmin(row: AdminRow): AdminReview {
  return {
    id: row.id,
    productId: row.productId,
    productTitle: row.product.title,
    shopName: row.shop.name,
    authorName: row.user.name ?? "Customer",
    authorEmail: row.user.email,
    orderNo: row.orderItem.shopOrder.order.orderNo,
    rating: row.rating,
    title: row.title,
    text: row.text,
    status: row.status,
    hiddenReason: row.hiddenReason,
    hiddenAt: iso(row.hiddenAt),
    hiddenBy: row.hiddenBy ? (row.hiddenBy.name ?? row.hiddenBy.email) : null,
    createdAt: row.createdAt.toISOString(),
    editedAt: iso(row.editedAt),
  };
}

export function itemFacts(row: ItemRow): ItemFacts {
  return {
    orderItemId: row.id,
    productId: row.productId,
    shopId: row.shopOrder.shopId,
    productShopId: row.product.shopId,
    orderUserId: row.shopOrder.order.userId,
    shopOrderStatus: row.shopOrder.status,
    reviewId: row.review?.id ?? null,
  };
}

const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;
const pageOf = (page: unknown) => {
  const n = typeof page === "string" ? Number(page) : typeof page === "number" ? page : 1;
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : 1;
};
const paged = <T>(items: T[], page: number, perPage: number, total: number): Paged<T> => ({
  items,
  page,
  perPage,
  total,
  totalPages: Math.max(1, Math.ceil(total / perPage)),
});

const isUniqueViolation = (err: unknown) => typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";

export const ADMIN_PER_PAGE = 20;

export function createReviewService(deps: ReviewDeps) {
  const { repo } = deps;

  /** POST /api/reviews: { orderItemId, rating, title?, text? } -> the new review's id. */
  async function create(userId: string, body: unknown): Promise<{ id: string; productId: string }> {
    const input = parseInput(createReviewSchema, body);
    const row = await repo.findItemForReview(userId, input.orderItemId);
    const facts = row ? itemFacts(row) : null;
    const members = facts ? await repo.memberShopIds(userId, [...new Set([facts.shopId, facts.productShopId])]) : new Set<string>();
    assertCanReview(facts, userId, members);
    let created: { id: string };
    try {
      created = await repo.createReview({
        userId,
        orderItemId: facts.orderItemId,
        productId: facts.productId,
        shopId: facts.shopId,
        rating: input.rating,
        title: input.title || null,
        text: input.text,
      });
    } catch (err) {
      // Submitted twice at once: the unique order item keeps one review.
      if (isUniqueViolation(err)) throw new ReviewError(409, "ALREADY_REVIEWED", "You have already reviewed this item. You can edit your review instead.");
      throw err;
    }
    deps.onProductsChanged([facts.productId]);
    return { id: created.id, productId: facts.productId };
  }

  /** PATCH /api/reviews/[id]: the author changes rating, title or text within the edit window. */
  async function update(userId: string, reviewId: string, body: unknown): Promise<{ id: string; productId: string }> {
    const input = parseInput(updateReviewSchema, body);
    const review = isId(reviewId) ? await repo.findOwnReview(userId, reviewId) : null;
    const members = review ? await repo.memberShopIds(userId, [review.shopId]) : new Set<string>();
    const now = deps.now();
    assertCanEdit(review, userId, members, now);
    const previous: ReviewChange = { rating: review.rating, title: review.title, text: review.text };
    const change: ReviewChange = {
      rating: input.rating ?? review.rating,
      title: input.title === undefined ? review.title : input.title || null,
      text: input.text ?? review.text,
    };
    if (!(await repo.updateOwnReview(userId, review.id, change, previous, now))) {
      throw new ReviewError(409, "REVIEW_HIDDEN", "This review was hidden by the platform and can't be edited");
    }
    deps.onProductsChanged([review.productId]);
    return { id: review.id, productId: review.productId };
  }

  async function moderate(adminId: string, reviewId: string, body: unknown, hide: boolean): Promise<{ id: string; status: ReviewStatus }> {
    const review = isId(reviewId) ? await repo.adminFindReview(reviewId) : null;
    if (hide) assertCanHide(review);
    else assertCanUnhide(review);
    const { reason } = parseInput(reasonSchema, body);
    const done = await repo.setStatus(review.id, review.status, adminId, reason, deps.now());
    if (!done) throw new ReviewError(409, hide ? "ALREADY_HIDDEN" : "NOT_HIDDEN", hide ? "This review is already hidden" : "This review is not hidden");
    deps.onProductsChanged([review.productId]);
    return { id: review.id, status: hide ? "hidden" : "visible" };
  }

  /** Platform Admin: hide with a reason (audit log). Hidden reviews leave the page and the rating. */
  const hide = (adminId: string, reviewId: string, body: unknown) => moderate(adminId, reviewId, body, true);
  /** Platform Admin: show a hidden review again, with a reason (audit log). */
  const unhide = (adminId: string, reviewId: string, body: unknown) => moderate(adminId, reviewId, body, false);

  /** The shop's public reply (owner or staff of that shop; `shopId` from requireShopRole). */
  async function reply(shopId: string, userId: string, reviewId: string, body: unknown): Promise<{ id: string }> {
    const { text } = parseInput(replySchema, body);
    if (!isId(reviewId) || !(await repo.setReply(shopId, reviewId, text, userId, deps.now()))) {
      throw new ReviewError(404, "NOT_FOUND", "Review not found");
    }
    return { id: reviewId };
  }

  /** A product's rating (average, count, histogram) from its aggregate. */
  async function productRating(productId: string): Promise<RatingView> {
    return ratingView(fromRatingRow(await repo.getProductRating(productId)));
  }

  /** GET /api/products/[id]/reviews and the product page: rating plus a page of visible reviews. */
  async function productReviews(productId: string, rawPage: unknown = 1): Promise<ProductReviewsView> {
    const page = pageOf(rawPage);
    const perPage = REVIEWS_PER_PAGE;
    const [rating, total, rows] = await Promise.all([
      productRating(productId),
      repo.countVisibleForProduct(productId),
      repo.listVisibleForProduct(productId, (page - 1) * perPage, perPage),
    ]);
    return { rating, reviews: rows.map(toPublic), page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) };
  }

  /** Review state of each of the user's order items (order pages); other users' items are left out. */
  async function itemStates(userId: string, orderItemIds: string[]): Promise<Record<string, ItemReviewState>> {
    const ids = [...new Set(orderItemIds.filter(isId))];
    if (ids.length === 0) return {};
    const rows = await repo.findItemsForUser(userId, ids);
    const members = await repo.memberShopIds(userId, [...new Set(rows.flatMap((r) => [r.shopOrder.shopId, r.product.shopId]))]);
    const now = deps.now();
    const out: Record<string, ItemReviewState> = {};
    for (const row of rows) {
      if (row.review) {
        out[row.id] = {
          kind: "reviewed",
          reviewId: row.review.id,
          rating: row.review.rating,
          status: row.review.status,
          hiddenReason: row.review.hiddenReason,
          canEdit: canEdit(row.review, now) && !members.has(row.shopOrder.shopId),
        };
      } else if (isShopMember(members, { shopId: row.shopOrder.shopId, productShopId: row.product.shopId })) {
        out[row.id] = { kind: "shop_member" };
      } else if (isReviewableStatus(row.shopOrder.status)) {
        out[row.id] = { kind: "can_review" };
      } else {
        out[row.id] = { kind: "not_delivered" };
      }
    }
    return out;
  }

  /** The write/edit page of one order item; null when it is not the user's item. */
  async function writeContext(userId: string, orderItemId: string): Promise<WriteContext | null> {
    if (!isId(orderItemId)) return null;
    const row = await repo.findItemForReview(userId, orderItemId);
    if (!row) return null;
    const facts = itemFacts(row);
    const members = await repo.memberShopIds(userId, [...new Set([facts.shopId, facts.productShopId])]);
    const item = {
      orderItemId: row.id,
      productId: row.productId,
      title: row.title,
      variantLabel: row.variantLabel,
      shopName: row.shopOrder.shopName,
      orderNo: row.shopOrder.order.orderNo,
    };
    const own = await repo.findOwnByItem(userId, orderItemId);
    if (own) {
      const review = toOwn(own, deps.now());
      const member = members.has(facts.shopId);
      return {
        item,
        review: { ...review, canEdit: review.canEdit && !member },
        mode: review.canEdit && !member ? "edit" : "locked",
        blocked: null,
      };
    }
    try {
      assertCanReview(facts, userId, members);
      return { item, review: null, mode: "create", blocked: null };
    } catch (err) {
      if (err instanceof ReviewError) return { item, review: null, mode: "locked", blocked: { code: err.code, message: err.message } };
      throw err;
    }
  }

  /** My reviews: delivered items waiting for a review, and the reviews written. */
  async function myReviews(userId: string): Promise<{ awaiting: AwaitingItem[]; reviews: OwnReview[] }> {
    const [awaitingRows, own] = await Promise.all([repo.itemsAwaitingReview(userId), repo.listForUser(userId)]);
    const members = await repo.memberShopIds(userId, [...new Set(awaitingRows.flatMap((r) => [r.shopOrder.shopId, r.product.shopId]))]);
    const now = deps.now();
    return {
      awaiting: awaitingRows
        .filter((r) => !isShopMember(members, { shopId: r.shopOrder.shopId, productShopId: r.product.shopId }))
        .map((r) => ({
          orderItemId: r.id,
          productId: r.productId,
          title: r.title,
          variantLabel: r.variantLabel,
          shopName: r.shopOrder.shopName,
          orderNo: r.shopOrder.order.orderNo,
          deliveredAt: iso(r.shopOrder.deliveredAt),
        })),
      reviews: own.map((r) => toOwn(r, now)),
    };
  }

  /** Seller centre: the shop's visible reviews (scoped by the guard-checked shopId). */
  async function shopReviews(shopId: string, rawPage: unknown = 1): Promise<Paged<ShopReview>> {
    const page = pageOf(rawPage);
    const [total, rows] = await Promise.all([repo.countForShop(shopId), repo.listForShop(shopId, (page - 1) * REVIEWS_PER_PAGE, REVIEWS_PER_PAGE)]);
    return paged(
      rows.map((r) => ({ ...toPublic(r), productId: r.productId, productTitle: r.product.title })),
      page,
      REVIEWS_PER_PAGE,
      total,
    );
  }

  /**
   * A shop's rating for the seller score (US-059): all visible reviews of its products, or only
   * those written in [from, to) for a rolling window.
   */
  async function shopRating(shopId: string, window?: { from: Date; to?: Date }): Promise<RatingView> {
    if (window) return ratingView(summarize(await repo.shopRatingsBetween(shopId, window.from, window.to ?? deps.now())));
    return ratingView(combine((await repo.shopRatingRows(shopId)).map(fromRatingRow)));
  }

  /** Platform Admin moderation queue (call after requirePlatformAdmin). */
  async function adminQueue(status: ReviewStatus, rawPage: unknown = 1): Promise<Paged<AdminReview>> {
    const page = pageOf(rawPage);
    const [total, rows] = await Promise.all([repo.adminCount(status), repo.adminList(status, (page - 1) * ADMIN_PER_PAGE, ADMIN_PER_PAGE)]);
    return paged(rows.map(toAdmin), page, ADMIN_PER_PAGE, total);
  }

  /** Metrics dashboard (US-083): reviews written in [from, to). */
  async function metrics(range: { from: Date; to: Date }): Promise<ReviewMetrics> {
    const rows = await repo.reviewsBetween(range.from, range.to);
    const visible = rows.filter((r) => r.status === "visible");
    return {
      written: rows.length,
      visible: visible.length,
      hidden: rows.length - visible.length,
      averageRating: displayRating(summarize(visible.map((r) => r.rating))),
    };
  }

  return {
    create,
    update,
    hide,
    unhide,
    reply,
    productRating,
    productReviews,
    itemStates,
    writeContext,
    myReviews,
    shopReviews,
    shopRating,
    adminQueue,
    metrics,
  };
}

export type ReviewService = ReturnType<typeof createReviewService>;

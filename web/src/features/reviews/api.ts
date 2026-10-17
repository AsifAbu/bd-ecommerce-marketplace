import { readJson, respond, ReviewError } from "./errors";
import { notDeletable } from "./rules";
import type { ReviewService } from "./service";

/**
 * JSON API of reviews (US-055). Errors use { error: { code, message, fields? } }.
 *   POST   /api/reviews                         customer: { orderItemId, rating, title?, text? } -> 201 { review: { id, productId } }
 *   PATCH  /api/reviews/[id]                    author:   { rating?, title?, text? } -> { review: { id, productId } }
 *   DELETE /api/reviews/[id]                    -> 405 REVIEW_NOT_DELETABLE (reviews are never deleted)
 *   GET    /api/products/[id]/reviews?page=n    public:   { rating, reviews, page, perPage, total, totalPages }
 *   POST   /api/admin/reviews/[id]/hide         Platform Admin: { reason } -> { review: { id, status: "hidden" } }
 *   POST   /api/admin/reviews/[id]/unhide       Platform Admin: { reason } -> { review: { id, status: "visible" } }
 *   PUT    /api/shops/[shopId]/reviews/[id]/reply  owner or staff of that shop: { text } -> { review: { id } }
 */
export function createReviewsApi(deps: {
  requireUser: () => Promise<{ id: string }>;
  requirePlatformAdmin: () => Promise<{ id: string }>;
  requireShopRole: (shopId: string, roles: readonly ("owner" | "staff")[]) => Promise<{ shopId: string; user: { id: string } }>;
  service: Pick<ReviewService, "create" | "update" | "hide" | "unhide" | "reply" | "productReviews">;
  /** True for a live listing (only those have a public page and public reviews). */
  isLiveProduct: (productId: string) => Promise<boolean>;
}) {
  return {
    create: (req: Request) =>
      respond(async () => {
        const user = await deps.requireUser();
        const review = await deps.service.create(user.id, await readJson(req));
        return Response.json({ review }, { status: 201 });
      }),

    update: (req: Request, reviewId: string) =>
      respond(async () => {
        const user = await deps.requireUser();
        return { review: await deps.service.update(user.id, reviewId, await readJson(req)) };
      }),

    remove: () =>
      respond(async () => {
        throw notDeletable();
      }),

    listForProduct: (req: Request, productId: string) =>
      respond(async () => {
        if (!(await deps.isLiveProduct(productId))) throw new ReviewError(404, "NOT_FOUND", "Product not found");
        return deps.service.productReviews(productId, new URL(req.url).searchParams.get("page") ?? 1);
      }),

    hide: (req: Request, reviewId: string) =>
      respond(async () => {
        const admin = await deps.requirePlatformAdmin();
        return { review: await deps.service.hide(admin.id, reviewId, await readJson(req)) };
      }),

    unhide: (req: Request, reviewId: string) =>
      respond(async () => {
        const admin = await deps.requirePlatformAdmin();
        return { review: await deps.service.unhide(admin.id, reviewId, await readJson(req)) };
      }),

    reply: (req: Request, shopId: string, reviewId: string) =>
      respond(async () => {
        const access = await deps.requireShopRole(shopId, ["owner", "staff"]);
        return { review: await deps.service.reply(access.shopId, access.user.id, reviewId, await readJson(req)) };
      }),
  };
}

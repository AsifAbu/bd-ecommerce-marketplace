import { liveProductWhere } from "@/features/products";
import { notifyProductsChanged } from "@/features/search";
import { dhakaToday } from "@/features/shops";
import { requirePlatformAdmin, requireShopRole, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createReviewsApi } from "./api";
import * as repo from "./repo";
import { createReviewService } from "./service";

/**
 * Reviews wired to the session and database. Other features use these:
 *   reviewService.productRating(productId)          product page summary (average, count, histogram)
 *   reviewService.shopRating(shopId, { from, to }?) seller score (US-059)
 *   reviewService.metrics({ from, to })             metrics dashboard (US-083)
 *   reviewService.itemStates(userId, orderItemIds)  "Write a review" on order pages
 * The search document reads the product_rating aggregate directly (search repo).
 */
export const reviewService = createReviewService({ repo, now: () => new Date(), onProductsChanged: notifyProductsChanged });

export const reviewsApi = createReviewsApi({
  requireUser,
  requirePlatformAdmin,
  requireShopRole,
  service: reviewService,
  isLiveProduct: async (productId) =>
    productId.length > 0 &&
    productId.length <= 64 &&
    (await prisma.product.count({ where: { ...liveProductWhere(dhakaToday(new Date())), id: productId } })) > 0,
});

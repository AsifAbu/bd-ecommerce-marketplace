import type { Prisma } from "@/generated/prisma/client";
import { liveProductWhere } from "@/features/products";
import { prisma } from "@/lib/db";

/**
 * Wishlist data access (ADR-004 style). Every function takes the logged-in `userId` first and
 * filters by it, so one customer can never read or remove another customer's items.
 */

const itemInclude = {
  product: {
    select: {
      id: true,
      title: true,
      categoryId: true,
      status: true,
      deletedAt: true,
      expiresOn: true,
      shop: { select: { name: true, status: true, medicineSuspended: true } },
      category: { select: { requiresLicence: true } },
      variants: { orderBy: { position: "asc" }, select: { id: true, price: true, stock: true, options: true } },
      images: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], take: 1, select: { id: true } },
    },
  },
} satisfies Prisma.WishlistItemInclude;

export function listItems(userId: string) {
  return prisma.wishlistItem.findMany({
    where: { userId },
    include: itemInclude,
    orderBy: { createdAt: "desc" },
  });
}

export function getItem(userId: string, itemId: string) {
  return prisma.wishlistItem.findFirst({ where: { id: itemId, userId }, include: itemInclude });
}

export function countItems(userId: string) {
  return prisma.wishlistItem.count({ where: { userId } });
}

/** The user's items for one product (the product page heart). */
export function findForProduct(userId: string, productId: string) {
  return prisma.wishlistItem.findMany({ where: { userId, productId }, select: { id: true, variantId: true } });
}

/** The user's item for this product and variant (null = saved without a variant). */
export function findSame(userId: string, productId: string, variantId: string | null) {
  return prisma.wishlistItem.findFirst({ where: { userId, productId, variantId } });
}

export function createItem(userId: string, productId: string, variantId: string | null) {
  return prisma.wishlistItem.create({ data: { userId, productId, variantId } });
}

/** True when the user's item was removed; false when it isn't theirs or doesn't exist. */
export async function deleteItem(userId: string, itemId: string): Promise<boolean> {
  const { count } = await prisma.wishlistItem.deleteMany({ where: { id: itemId, userId } });
  return count > 0;
}

/** A live product and its variant ids (public data), for adding to a wishlist. */
export function findLiveProduct(productId: string, today: Date) {
  return prisma.product.findFirst({
    where: { ...liveProductWhere(today), id: productId },
    select: { id: true, variants: { select: { id: true } } },
  });
}

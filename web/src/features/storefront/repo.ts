import { liveProductWhere } from "@/features/products";
import { prisma } from "@/lib/db";

/**
 * Storefront data access (US-014). Public and read-only, so every function returns
 * customer-safe fields only (never the owner's NID, photo or documents). The shop is looked up
 * by slug and must be approved; every product read then takes that shop's id first and filters
 * by it (ADR-004), so another shop's products never appear.
 */

/** An approved shop by its slug (pending, rejected and suspended shops are not public). */
export function findApprovedShop(slug: string) {
  return prisma.shop.findFirst({
    where: { slug, status: "approved" },
    select: {
      id: true,
      name: true,
      slug: true,
      tier: true,
      logoUrl: true,
      bannerUrl: true,
      description: true,
      policies: true,
      createdAt: true,
    },
  });
}

/** In-stock variants of the shop's live products: what the grid, prices and filters are built from. */
export function listInStockVariants(shopId: string, today: Date) {
  return prisma.productVariant.findMany({
    where: { shopId, stock: { gt: 0 }, product: { ...liveProductWhere(today), shopId } },
    select: { productId: true, price: true },
  });
}

export function listProducts(shopId: string, productIds: string[]) {
  return prisma.product.findMany({
    where: { shopId, id: { in: productIds } },
    select: { id: true, title: true, categoryId: true, createdAt: true },
  });
}

export function listImages(shopId: string, productIds: string[]) {
  return prisma.productImage.findMany({
    where: { shopId, productId: { in: productIds } },
    select: { id: true, productId: true, position: true, createdAt: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
}

export function listCategories(categoryIds: string[]) {
  return prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
}

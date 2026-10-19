import { prisma } from "@/lib/db";

/** A variant at or below this many units counts as low stock on the seller dashboard. */
export const LOW_STOCK_AT = 5;

export interface LowStockItem {
  productId: string;
  title: string;
  /** The lowest stock among the product's low variants. */
  stock: number;
  /** How many of its variants are low. */
  variants: number;
}

/**
 * Active products of one shop with a variant at or below LOW_STOCK_AT (read only, shop-scoped:
 * `shopId` must come from requireShopRole). Lowest stock first, at most `limit` products.
 */
export async function lowStockOf(shopId: string, limit = 5): Promise<LowStockItem[]> {
  const rows = await prisma.productVariant.findMany({
    where: { shopId, stock: { lte: LOW_STOCK_AT }, product: { shopId, deletedAt: null, status: "active" } },
    select: { stock: true, product: { select: { id: true, title: true } } },
    orderBy: { stock: "asc" },
    take: 200,
  });
  const byProduct = new Map<string, LowStockItem>();
  for (const r of rows) {
    const item = byProduct.get(r.product.id);
    if (item) item.variants += 1;
    else byProduct.set(r.product.id, { productId: r.product.id, title: r.product.title, stock: r.stock, variants: 1 });
  }
  return [...byProduct.values()].slice(0, limit);
}

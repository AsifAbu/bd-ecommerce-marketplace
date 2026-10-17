import type { Prisma } from "@/generated/prisma/client";
import { liveProductWhere } from "@/features/products";
import { prisma } from "@/lib/db";
import type { HomeProduct, HomeShop } from "./loader";

/** Home page reads. Public and read-only; live listings (liveProductWhere) with stock only. */

export function homeWhere(today: Date): Prisma.ProductWhereInput {
  return { AND: [liveProductWhere(today), { variants: { some: { stock: { gt: 0 } } } }] };
}

const select = {
  id: true,
  title: true,
  shop: { select: { slug: true, name: true } },
  category: { select: { name: true } },
  variants: { where: { stock: { gt: 0 } }, select: { price: true } },
  images: { select: { id: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], take: 1 },
} satisfies Prisma.ProductSelect;

type Row = Prisma.ProductGetPayload<{ select: typeof select }>;

export function toHomeProduct(p: Row): HomeProduct {
  const prices = p.variants.map((v) => Number(v.price.toString()));
  return {
    id: p.id,
    title: p.title,
    priceMin: Math.min(...prices),
    priceMax: Math.max(...prices),
    shopName: p.shop.name,
    shopSlug: p.shop.slug,
    categoryName: p.category.name,
    imageUrl: p.images[0] ? `/api/product-images/${encodeURIComponent(p.images[0].id)}` : null,
    rating: null,
  };
}

export async function newArrivals(today: Date, limit: number): Promise<HomeProduct[]> {
  const rows = await prisma.product.findMany({
    where: homeWhere(today),
    select,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: limit,
  });
  return rows.map(toHomeProduct);
}

export async function productsUnder(today: Date, categoryId: string, limit: number): Promise<HomeProduct[]> {
  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { path: true } });
  if (!category) return [];
  const rows = await prisma.product.findMany({
    where: { AND: [homeWhere(today), { category: { path: { startsWith: category.path } } }] },
    select,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: limit,
  });
  return rows.map(toHomeProduct);
}

/** Approved shops with the most live products first. */
export async function featuredShops(today: Date, limit: number): Promise<HomeShop[]> {
  const counts = await prisma.product.groupBy({
    by: ["shopId"],
    where: homeWhere(today),
    _count: { _all: true },
    orderBy: { _count: { shopId: "desc" } },
    take: limit,
  });
  if (counts.length === 0) return [];
  const shops = await prisma.shop.findMany({
    where: { id: { in: counts.map((c) => c.shopId) }, status: "approved" },
    select: { id: true, slug: true, name: true, tier: true },
  });
  const byId = new Map(shops.map((s) => [s.id, s]));
  return counts.flatMap((c) => {
    const s = byId.get(c.shopId);
    return s ? [{ id: s.id, slug: s.slug, name: s.name, verified: s.tier === "verified", productCount: c._count._all }] : [];
  });
}

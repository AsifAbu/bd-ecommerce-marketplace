import { cache } from "react";
import { dhakaToday } from "@/features/shops";
import { sortAndPage, type StorefrontQuery } from "./query";
import * as repo from "./repo";

/**
 * US-014: one shop's public storefront. Only approved shops; only live products with at least
 * one variant in stock. Sorting and paging happen in memory over the shop's in-stock listings
 * (price sorts need the lowest in-stock variant price); fine for R1 shop sizes.
 */

export type StorefrontShop = NonNullable<Awaited<ReturnType<typeof repo.findApprovedShop>>>;

export interface StorefrontProduct {
  id: string;
  title: string;
  createdAt: Date;
  minPrice: number;
  maxPrice: number;
  /** Cover image id (lowest position), for /api/product-images/<id>; null when there is none. */
  coverImageId: string | null;
}

export interface StorefrontCategory {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export interface StorefrontData {
  shop: StorefrontShop;
  /** Only categories this shop has live, in-stock products in. */
  categories: StorefrontCategory[];
  /** The selected category, or null (none chosen, or a slug the shop has no products in). */
  category: StorefrontCategory | null;
  products: StorefrontProduct[];
  page: number;
  totalPages: number;
  total: number;
  sort: StorefrontQuery["sort"];
}

/** The approved shop for a slug; cached per request so the page and its metadata share one query. */
export const getStorefrontShop = cache((slug: string) => repo.findApprovedShop(slug));

export async function loadStorefront(slug: string, query: StorefrontQuery, now: Date): Promise<StorefrontData | null> {
  const shop = await getStorefrontShop(slug);
  if (!shop) return null;

  const variants = await repo.listInStockVariants(shop.id, dhakaToday(now));
  const prices = new Map<string, number[]>();
  for (const v of variants) {
    const list = prices.get(v.productId) ?? [];
    list.push(Number(v.price.toString()));
    prices.set(v.productId, list);
  }
  const products = prices.size ? await repo.listProducts(shop.id, [...prices.keys()]) : [];

  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
  const categories = counts.size
    ? (await repo.listCategories([...counts.keys()]))
        .map((c) => ({ ...c, count: counts.get(c.id) ?? 0 }))
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const category = (query.category && categories.find((c) => c.slug === query.category)) || null;

  const rows = products
    .filter((p) => !category || p.categoryId === category.id)
    .map((p) => {
      const list = prices.get(p.id)!;
      return { id: p.id, title: p.title, createdAt: p.createdAt, minPrice: Math.min(...list), maxPrice: Math.max(...list) };
    });
  const paged = sortAndPage(rows, query.sort, query.page);

  const images = paged.items.length ? await repo.listImages(shop.id, paged.items.map((p) => p.id)) : [];
  const covers = new Map<string, (typeof images)[number]>();
  for (const img of images) {
    const current = covers.get(img.productId);
    if (!current || img.position < current.position || (img.position === current.position && img.createdAt < current.createdAt)) {
      covers.set(img.productId, img);
    }
  }

  return {
    shop,
    categories,
    category,
    products: paged.items.map((p) => ({ ...p, coverImageId: covers.get(p.id)?.id ?? null })),
    page: paged.page,
    totalPages: paged.totalPages,
    total: paged.total,
    sort: query.sort,
  };
}

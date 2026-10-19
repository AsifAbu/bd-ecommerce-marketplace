import type { VisibleCategory } from "@/features/search/categories";

/**
 * Home page data (storefront landing): category tiles, new arrivals, a product row per top
 * category and featured shops. Pure: the database reads are injected (see ./server.ts), and they
 * only ever return live, in-stock products of approved shops.
 */

export interface HomeProduct {
  id: string;
  title: string;
  priceMin: number;
  priceMax: number;
  shopName: string;
  shopSlug: string;
  /** The shop is a Verified seller. */
  shopVerified?: boolean;
  categoryName: string;
  /** Cover image through /api/product-images/<id>, or null. */
  imageUrl: string | null;
  /** Average rating once reviews exist (US-055); null until then. */
  rating: number | null;
}

export interface HomeShop {
  id: string;
  slug: string;
  name: string;
  verified: boolean;
  productCount: number;
}

export interface HomeRow {
  category: { id: string; name: string; slug: string; count: number };
  products: HomeProduct[];
}

export interface HomeData {
  /** Top-level categories that have live products, with roll-up counts. */
  categories: VisibleCategory[];
  arrivals: HomeProduct[];
  rows: HomeRow[];
  shops: HomeShop[];
  /** Nothing to sell yet (fresh database). */
  isEmpty: boolean;
}

export interface HomeDeps {
  categoryTree(): Promise<VisibleCategory[]>;
  newArrivals(limit: number): Promise<HomeProduct[]>;
  productsUnder(categoryId: string, limit: number): Promise<HomeProduct[]>;
  featuredShops(limit: number): Promise<HomeShop[]>;
}

export const HOME_LIMITS = { arrivals: 10, rows: 3, perRow: 5, shops: 8 } as const;

export async function loadHome(deps: HomeDeps): Promise<HomeData> {
  const tree = await deps.categoryTree();
  const categories = tree.filter((c) => c.count > 0);
  const rowCategories = [...categories].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, HOME_LIMITS.rows);

  const [arrivals, rowProducts, shops] = await Promise.all([
    deps.newArrivals(HOME_LIMITS.arrivals),
    Promise.all(rowCategories.map((c) => deps.productsUnder(c.id, HOME_LIMITS.perRow))),
    deps.featuredShops(HOME_LIMITS.shops),
  ]);

  const rows = rowCategories
    .map((c, i) => ({ category: { id: c.id, name: c.name, slug: c.slug, count: c.count }, products: rowProducts[i] }))
    .filter((r) => r.products.length > 0);

  return { categories, arrivals, rows, shops, isEmpty: categories.length === 0 && arrivals.length === 0 };
}

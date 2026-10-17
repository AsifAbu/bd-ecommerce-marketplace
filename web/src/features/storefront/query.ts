/**
 * Storefront URL parameters and in-memory sorting/paging (pure). `?category=<category slug>`,
 * `?sort=newest|price_asc|price_desc`, `?page=<n>`. Unknown values fall back to the defaults.
 */

export const PAGE_SIZE = 24;

export const SORTS = ["newest", "price_asc", "price_desc"] as const;
export type StorefrontSort = (typeof SORTS)[number];

export const SORT_LABELS: Record<StorefrontSort, string> = {
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
};

export interface StorefrontQuery {
  page: number;
  sort: StorefrontSort;
  /** Category slug, or null for all categories. */
  category: string | null;
}

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export function parseStorefrontQuery(params: Params): StorefrontQuery {
  const pageRaw = first(params.page);
  const page = pageRaw && /^\d{1,6}$/.test(pageRaw) ? Math.max(1, Number(pageRaw)) : 1;
  const sortRaw = first(params.sort);
  const sort = SORTS.includes(sortRaw as StorefrontSort) ? (sortRaw as StorefrontSort) : "newest";
  const category = first(params.category);
  return { page, sort, category: category && /^[a-z0-9-]{1,100}$/.test(category) ? category : null };
}

/** Query string for a storefront link; defaults are left out. */
export function storefrontQueryString(q: Partial<StorefrontQuery>): string {
  const params = new URLSearchParams();
  if (q.category) params.set("category", q.category);
  if (q.sort && q.sort !== "newest") params.set("sort", q.sort);
  if (q.page && q.page > 1) params.set("page", String(q.page));
  const s = params.toString();
  return s ? `?${s}` : "";
}

export interface Sortable {
  id: string;
  createdAt: Date;
  minPrice: number;
}

/** Sorts (ties by newest, then id, so pages are stable) and cuts one page; the page is clamped. */
export function sortAndPage<T extends Sortable>(items: T[], sort: StorefrontSort, page: number, pageSize = PAGE_SIZE) {
  const newest = (a: T, b: T) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id);
  const sorted = [...items].sort((a, b) => {
    if (sort === "price_asc") return a.minPrice - b.minPrice || newest(a, b);
    if (sort === "price_desc") return b.minPrice - a.minPrice || newest(a, b);
    return newest(a, b);
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  return {
    items: sorted.slice((current - 1) * pageSize, current * pageSize),
    page: current,
    totalPages,
    total: sorted.length,
  };
}

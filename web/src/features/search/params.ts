import { MAX_PAGE } from "./config";
import { SearchError } from "./errors";

/**
 * The URL is the single source of filter state (US-042): every search page and GET /api/search
 * read the same parameters, and every link the UI renders is built with toSearchParams, so a
 * copied URL shows the same results and filters.
 *
 *   q             keywords (Bengali, Banglish or English)
 *   category      category slug (leaf: its filters; parent: common filters + "Narrow by category")
 *   f.<key>       an option of a checkbox filter (repeat for several: OR within one filter)
 *   f.<key>.min   lower bound of a number filter; f.<key>.max upper bound
 *   f.<key>=1     a yes/no (toggle) filter switched on
 *   price_min, price_max   in Tk
 *   shop          shop slug (repeat for several)
 *   rating        minimum average rating, 1 to 4 ("4 stars & up", US-055)
 *   sort          relevance (default), price_asc, price_desc, newest, rating
 *   page          1-based, 24 per page
 */

export const SORTS = ["relevance", "price_asc", "price_desc", "newest", "rating"] as const;
export type Sort = (typeof SORTS)[number];

export const SORT_LABELS: Record<Sort, string> = {
  relevance: "Best match",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  newest: "Newest",
  rating: "Customer rating",
};

/** The "N stars & up" choices of the rating filter. */
export const RATING_THRESHOLDS = [4, 3, 2, 1] as const;

export interface AttrParam {
  values: string[];
  min: number | null;
  max: number | null;
}

export interface SearchParams {
  q: string;
  category: string | null;
  attrs: Record<string, AttrParam>;
  priceMin: number | null;
  priceMax: number | null;
  shops: string[];
  /** Minimum average rating (1 to 4), or null. */
  minRating: number | null;
  sort: Sort;
  page: number;
}

export type RawParams = URLSearchParams | Record<string, string | string[] | undefined>;

export const MAX_QUERY_LENGTH = 100;
const MAX_VALUES = 20;
const MAX_ATTR_FILTERS = 20;
const KEY = /^[a-z0-9_]{1,64}$/;
const SLUG = /^[a-z0-9-]{1,120}$/;

export const EMPTY_SEARCH: SearchParams = {
  q: "",
  category: null,
  attrs: {},
  priceMin: null,
  priceMax: null,
  shops: [],
  minRating: null,
  sort: "relevance",
  page: 1,
};

function entries(raw: RawParams): [string, string][] {
  if (raw instanceof URLSearchParams) return [...raw.entries()];
  return Object.entries(raw).flatMap(([k, v]) => (v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((x) => [k, x] as [string, string])));
}

function parseNumber(value: string, field: string, fields: Record<string, string>): number | null {
  const s = value.trim().replace(/,/g, "");
  if (s === "") return null;
  if (!/^\d+(\.\d+)?$/.test(s) || s.length > 15) {
    fields[field] = "Enter a number";
    return null;
  }
  return Number(s);
}

/**
 * Parses and checks search parameters. Empty values are ignored (a GET form sends blank inputs);
 * malformed ones throw a 400 SearchError with field messages.
 */
export function parseSearchParams(raw: RawParams): SearchParams {
  const fields: Record<string, string> = {};
  const out: SearchParams = { ...EMPTY_SEARCH, attrs: {}, shops: [] };
  const attr = (key: string): AttrParam => (out.attrs[key] ??= { values: [], min: null, max: null });

  for (const [name, rawValue] of entries(raw)) {
    const value = rawValue.trim();
    if (value === "") continue;
    if (name === "q") {
      if (value.length > MAX_QUERY_LENGTH) fields.q = `Search words can be at most ${MAX_QUERY_LENGTH} characters`;
      else out.q = value.replace(/\s+/g, " ");
    } else if (name === "category") {
      if (!SLUG.test(value)) fields.category = "Unknown category";
      else out.category = value;
    } else if (name === "price_min" || name === "price_max") {
      const n = parseNumber(value, name, fields);
      if (name === "price_min") out.priceMin = n;
      else out.priceMax = n;
    } else if (name === "shop") {
      if (!SLUG.test(value)) fields.shop = "Unknown shop";
      else if (!out.shops.includes(value) && out.shops.length < MAX_VALUES) out.shops.push(value);
    } else if (name === "rating") {
      if (!(RATING_THRESHOLDS as readonly number[]).includes(Number(value)) || !/^\d$/.test(value)) fields.rating = "Rating must be 1, 2, 3 or 4";
      else out.minRating = Number(value);
    } else if (name === "sort") {
      if (!(SORTS as readonly string[]).includes(value)) fields.sort = `Sort must be one of ${SORTS.join(", ")}`;
      else out.sort = value as Sort;
    } else if (name === "page") {
      const n = /^\d{1,4}$/.test(value) ? Number(value) : NaN;
      if (!Number.isInteger(n) || n < 1 || n > MAX_PAGE) fields.page = `Page must be a whole number from 1 to ${MAX_PAGE}`;
      else out.page = n;
    } else if (name.startsWith("f.")) {
      const [, key, bound] = name.split(".");
      if (!key || !KEY.test(key) || (bound !== undefined && bound !== "min" && bound !== "max") || name.split(".").length > 3) {
        fields[name] = "Unknown filter";
        continue;
      }
      if (!(key in out.attrs) && Object.keys(out.attrs).length >= MAX_ATTR_FILTERS) continue;
      if (bound) {
        const n = parseNumber(value, name, fields);
        attr(key)[bound] = n;
      } else if (value.length <= 200) {
        const a = attr(key);
        if (!a.values.includes(value) && a.values.length < MAX_VALUES) a.values.push(value);
      }
    }
    // Anything else (utm_source, ...) is ignored.
  }

  if (out.priceMin !== null && out.priceMax !== null && out.priceMin > out.priceMax) {
    fields.price_max = "The highest price must be at least the lowest price";
  }
  for (const [key, a] of Object.entries(out.attrs)) {
    if (a.min !== null && a.max !== null && a.min > a.max) fields[`f.${key}.max`] = "The upper bound must be at least the lower bound";
  }
  if (Object.keys(fields).length > 0) {
    const keys = Object.keys(fields);
    throw new SearchError(400, "INVALID_PARAMS", keys.length === 1 ? fields[keys[0]] : "Some search settings are not valid", fields);
  }
  return out;
}

/** Canonical query string of a search (stable order, defaults left out). */
export function toSearchParams(s: SearchParams, options: { omitCategory?: boolean } = {}): URLSearchParams {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  if (s.category && !options.omitCategory) p.set("category", s.category);
  for (const key of Object.keys(s.attrs).sort()) {
    const a = s.attrs[key];
    for (const v of a.values) p.append(`f.${key}`, v);
    if (a.min !== null) p.set(`f.${key}.min`, String(a.min));
    if (a.max !== null) p.set(`f.${key}.max`, String(a.max));
  }
  if (s.priceMin !== null) p.set("price_min", String(s.priceMin));
  if (s.priceMax !== null) p.set("price_max", String(s.priceMax));
  for (const shop of s.shops) p.append("shop", shop);
  if (s.minRating !== null) p.set("rating", String(s.minRating));
  if (s.sort !== "relevance") p.set("sort", s.sort);
  if (s.page > 1) p.set("page", String(s.page));
  return p;
}

/** A link to `path` with this search; `change` edits a copy (page goes back to 1 unless set). */
export function searchHref(path: string, s: SearchParams, change?: (draft: SearchParams) => void, options?: { omitCategory?: boolean }): string {
  const draft: SearchParams = structuredClone(s);
  if (change) {
    draft.page = 1;
    change(draft);
  }
  for (const [key, a] of Object.entries(draft.attrs)) {
    if (a.values.length === 0 && a.min === null && a.max === null) delete draft.attrs[key];
  }
  const qs = toSearchParams(draft, options).toString();
  return qs ? `${path}?${qs}` : path;
}

/** True when any filter (not the keywords, category, sort or page) is set. */
export function hasFilters(s: SearchParams): boolean {
  return Object.keys(s.attrs).length > 0 || s.priceMin !== null || s.priceMax !== null || s.shops.length > 0 || s.minRating !== null;
}

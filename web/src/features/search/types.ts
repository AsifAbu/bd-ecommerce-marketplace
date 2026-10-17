import type { Sort } from "./params";

/**
 * One searchable product (one document per product, ADR-003). Built only from live listings with
 * at least one variant in stock; prices and variant-axis values come from in-stock variants.
 */
export interface SearchDocument {
  id: string;
  title: string;
  bengaliName: string | null;
  /** Shortened description (searchable). */
  description: string;
  /** Brand label (option label for an enum brand, the text otherwise), searchable. */
  brand: string | null;
  /** Other short text values (model number, ISBN, author, generic name...), searchable. */
  keywords: string;
  shopId: string;
  shopSlug: string;
  shopName: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  /** Ids from the root to the leaf, so a parent category filter matches its whole subtree. */
  categoryPath: string[];
  /** Category names from the root to the leaf, searchable ("boi" finds everything under Books). */
  categoryNames: string[];
  priceMin: number;
  priceMax: number;
  inStock: true;
  coverImageId: string | null;
  /** Epoch ms. */
  createdAt: number;
  /** Average star rating of the visible reviews to 1 decimal (US-055); null without reviews. */
  rating: number | null;
  /** Number of visible reviews (0 without reviews). */
  ratingCount: number;
  /**
   * Filterable values by attribute key: option values or short texts (string[]), numbers
   * (number[]) and yes/no (boolean). Variant axes hold the union over in-stock variants.
   */
  attrs: Record<string, string[] | number[] | boolean>;
}

export type FacetKind = "values" | "range" | "toggle";

export type AttrFilter =
  | { key: string; kind: "values"; values: string[] }
  | { key: string; kind: "range"; min: number | null; max: number | null }
  | { key: string; kind: "toggle" };

export interface EngineRequest {
  /** The raw keywords (Meilisearch applies its own synonyms and typo tolerance). */
  q: string;
  /** Expanded keywords: per query word, its alternatives (Postgres adapter). */
  terms: string[][];
  /** Category scope (any level): matches documents whose categoryPath contains the id. */
  category: { id: string; path: string } | null;
  shops: string[];
  price: { min: number | null; max: number | null } | null;
  attrs: AttrFilter[];
  /** "4 stars & up": only documents whose rating is at least this (US-055); null for any. */
  minRating: number | null;
  /** Attribute facets to count (the category's filterable attributes). */
  facets: { key: string; kind: FacetKind }[];
  sort: Sort;
  page: number;
  perPage: number;
}

export interface AttrFacetResult {
  values?: Record<string, number>;
  range?: { min: number; max: number } | null;
  trueCount?: number;
}

export interface EngineFacets {
  /** Leaf category id to count, within the current results. */
  categories: Record<string, number>;
  /** Shop slug to count (disjunctive: the shop filter itself is not applied). */
  shops: Record<string, number>;
  /** Lowest and highest price in the results (price filter not applied). */
  price: { min: number; max: number } | null;
  /**
   * Documents per rating threshold ("4" = rated 4 or more), within the results of the other
   * filters (the rating filter itself is not applied).
   */
  rating: Record<string, number>;
  attrs: Record<string, AttrFacetResult>;
}

export interface EngineResult {
  hits: SearchDocument[];
  total: number;
  facets: EngineFacets;
}

/** A search backend. Adapters: Meilisearch (production) and Postgres (fallback, dev, tests). */
export interface SearchEngine {
  readonly name: "meilisearch" | "postgres";
  search(request: EngineRequest): Promise<EngineResult>;
}

/** An engine that keeps its own index and must be told about product changes. */
export interface IndexingEngine extends SearchEngine {
  configure(): Promise<void>;
  upsert(docs: SearchDocument[]): Promise<void>;
  remove(ids: string[]): Promise<void>;
  /** Removes documents indexed before `before` (epoch ms): the tail of a full re-index. */
  removeStale(before: number): Promise<void>;
}

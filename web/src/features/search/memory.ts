import { searchableFields } from "./documents";
import type { AttrFilter, EngineFacets, EngineRequest, EngineResult, SearchDocument } from "./types";

/**
 * Filtering, facet counting, relevance and sorting over documents in memory (pure). The Postgres
 * adapter loads candidate documents and runs this; the Meilisearch adapter gets the same answers
 * from the engine. Facets are disjunctive: each facet is counted within the results of every
 * other filter but not its own, so options of the same filter can be combined (OR) and an
 * option with 0 results under the other filters can be hidden.
 */

/** Relevance of a document for expanded query words; null when a word does not match at all. */
export function textScore(doc: SearchDocument, terms: string[][]): number | null {
  if (terms.length === 0) return 0;
  const fields = searchableFields(doc);
  let total = 0;
  for (const alternatives of terms) {
    let best = 0;
    alternatives.forEach((alt, i) => {
      for (const { text, weight } of fields) {
        const at = text.indexOf(alt);
        if (at < 0) continue;
        const startsWord = at === 0 || text[at - 1] === " ";
        const endsWord = at + alt.length === text.length || text[at + alt.length] === " ";
        // Whole words beat parts of words; the word as typed beats its synonyms.
        const score = weight * (startsWord ? (endsWord ? 3 : 2) : 1) * (i === 0 ? 1 : 0.8);
        best = Math.max(best, score);
      }
    });
    if (best === 0) return null;
    total += best;
  }
  return total;
}

export function inCategory(doc: SearchDocument, categoryId: string | null | undefined): boolean {
  return !categoryId || doc.categoryPath.includes(categoryId);
}

export function matchesAttr(doc: SearchDocument, filter: AttrFilter): boolean {
  const value = doc.attrs[filter.key];
  switch (filter.kind) {
    case "toggle":
      return value === true;
    case "values": {
      if (!Array.isArray(value)) return false;
      const wanted = new Set(filter.values);
      return (value as (string | number)[]).some((v) => wanted.has(String(v)));
    }
    case "range": {
      if (!Array.isArray(value)) return false;
      return (value as (string | number)[]).some((v) => {
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) && (filter.min === null || n >= filter.min) && (filter.max === null || n <= filter.max);
      });
    }
  }
}

/** Price ranges overlap: some in-stock variant can be in the wanted range. */
export function matchesPrice(doc: SearchDocument, price: EngineRequest["price"]): boolean {
  if (!price) return true;
  return (price.min === null || doc.priceMax >= price.min) && (price.max === null || doc.priceMin <= price.max);
}

/** "N stars & up": rated at least `min` (unrated products never match a rating filter). */
export function matchesRating(doc: SearchDocument, min: number | null | undefined): boolean {
  return min === null || min === undefined || (doc.rating !== null && doc.rating >= min);
}

/** The thresholds counted by the rating facet ("4" = 4 stars & up). */
export const RATING_FACET_THRESHOLDS = [4, 3, 2, 1] as const;

type Except = { shops?: boolean; price?: boolean; rating?: boolean; attr?: string };

function passes(doc: SearchDocument, req: EngineRequest, except: Except = {}): boolean {
  if (!except.shops && req.shops.length > 0 && !req.shops.includes(doc.shopSlug)) return false;
  if (!except.price && !matchesPrice(doc, req.price)) return false;
  if (!except.rating && !matchesRating(doc, req.minRating)) return false;
  return req.attrs.every((f) => f.key === except.attr || matchesAttr(doc, f));
}

const increment = (map: Record<string, number>, key: string) => {
  map[key] = (map[key] ?? 0) + 1;
};

function minMax(values: number[]): { min: number; max: number } | null {
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** Facet counts over the documents that match the keywords and category scope. */
export function computeFacets(scoped: SearchDocument[], req: EngineRequest): EngineFacets {
  const facets: EngineFacets = { categories: {}, shops: {}, price: null, rating: {}, attrs: {} };
  const prices: number[] = [];
  for (const doc of scoped) {
    if (passes(doc, req)) increment(facets.categories, doc.categoryId);
    if (passes(doc, req, { shops: true })) increment(facets.shops, doc.shopSlug);
    if (passes(doc, req, { price: true })) prices.push(doc.priceMin, doc.priceMax);
    if (doc.rating !== null && passes(doc, req, { rating: true })) {
      for (const t of RATING_FACET_THRESHOLDS) if (doc.rating >= t) increment(facets.rating, String(t));
    }
  }
  facets.price = minMax(prices);

  for (const facet of req.facets) {
    const result: EngineFacets["attrs"][string] = {};
    const values: Record<string, number> = {};
    const numbers: number[] = [];
    let trueCount = 0;
    for (const doc of scoped) {
      if (!passes(doc, req, { attr: facet.key })) continue;
      const value = doc.attrs[facet.key];
      if (facet.kind === "toggle") {
        if (value === true) trueCount++;
      } else if (Array.isArray(value)) {
        if (facet.kind === "values") for (const v of new Set((value as (string | number)[]).map(String))) increment(values, v);
        else for (const v of value as (string | number)[]) if (Number.isFinite(Number(v))) numbers.push(Number(v));
      }
    }
    if (facet.kind === "values") result.values = values;
    if (facet.kind === "range") result.range = minMax(numbers);
    if (facet.kind === "toggle") result.trueCount = trueCount;
    facets.attrs[facet.key] = result;
  }
  return facets;
}

function compare(req: EngineRequest, scores: Map<string, number>) {
  const newest = (a: SearchDocument, b: SearchDocument) => b.createdAt - a.createdAt || a.id.localeCompare(b.id);
  switch (req.sort) {
    case "price_asc":
      return (a: SearchDocument, b: SearchDocument) => a.priceMin - b.priceMin || newest(a, b);
    case "price_desc":
      return (a: SearchDocument, b: SearchDocument) => b.priceMin - a.priceMin || newest(a, b);
    case "newest":
      return newest;
    case "rating":
      // Best rated first; unrated last; more reviews break a tie.
      return (a: SearchDocument, b: SearchDocument) =>
        (b.rating ?? -1) - (a.rating ?? -1) || b.ratingCount - a.ratingCount || newest(a, b);
    case "relevance":
      return (a: SearchDocument, b: SearchDocument) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || newest(a, b);
  }
}

/** The whole search over candidate documents: keywords, scope, filters, facets, sort, page. */
export function searchDocuments(candidates: SearchDocument[], req: EngineRequest): EngineResult {
  const scores = new Map<string, number>();
  const scoped: SearchDocument[] = [];
  for (const doc of candidates) {
    if (!inCategory(doc, req.category?.id)) continue;
    const score = textScore(doc, req.terms);
    if (score === null) continue;
    scores.set(doc.id, score);
    scoped.push(doc);
  }
  const matching = scoped.filter((doc) => passes(doc, req)).sort(compare(req, scores));
  const start = (req.page - 1) * req.perPage;
  return {
    hits: matching.slice(start, start + req.perPage),
    total: matching.length,
    facets: computeFacets(scoped, req),
  };
}

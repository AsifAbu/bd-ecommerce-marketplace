import type { FilterWidget } from "@/generated/prisma/enums";
import { MAX_FACET_OPTIONS, PER_PAGE } from "./config";
import { SearchError } from "./errors";
import { parseSearchParams, RATING_THRESHOLDS, type RawParams, type SearchParams } from "./params";
import { expandQuery } from "./synonyms";
import type { AttrFilter, EngineRequest, EngineResult, FacetKind, SearchEngine } from "./types";

/**
 * US-041 / US-042: keyword search and category results with dynamic filters. The service turns
 * URL parameters into an engine request (only the category's filterable attributes become
 * filters), runs it, and shapes items and facets for the page and GET /api/search.
 */

export interface CategoryInfo {
  id: string;
  slug: string;
  name: string;
  path: string;
  isLeaf: boolean;
  archivedAt: Date | null;
}

/** A filterable attribute of a leaf category (from the catalog schema). */
export interface FilterField {
  key: string;
  name: string;
  type: "enum" | "multi_enum" | "number" | "boolean" | "text" | "date";
  unit: string | null;
  widget: FilterWidget | null;
  displayOrder: number;
  options: { value: string; label: string }[];
}

export interface SearchServiceDeps {
  findCategory(slug: string): Promise<CategoryInfo | null>;
  getFilterFields(categoryId: string): Promise<FilterField[]>;
  categoriesByIds(ids: string[]): Promise<{ id: string; slug: string; name: string }[]>;
  shopsBySlugs(slugs: string[]): Promise<{ slug: string; name: string }[]>;
  engine: { search(req: EngineRequest): Promise<{ result: EngineResult; engine: SearchEngine["name"] }> };
}

export interface SearchItem {
  id: string;
  title: string;
  bengaliName: string | null;
  priceMin: number;
  priceMax: number;
  shopName: string;
  shopSlug: string;
  categoryName: string;
  /** Average star rating to 1 decimal (US-055), null without reviews; and the review count. */
  rating: number | null;
  ratingCount: number;
  /** Cover image through the signed-URL redirect, or null. */
  imageUrl: string | null;
  url: string;
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
  selected: boolean;
}

export type AttributeFacet =
  | { key: string; name: string; unit: string | null; widget: "checkbox_list"; options: FacetOption[] }
  | { key: string; name: string; unit: string | null; widget: "range_slider"; min: number; max: number; selectedMin: number | null; selectedMax: number | null }
  | { key: string; name: string; unit: string | null; widget: "toggle"; count: number; selected: boolean };

export interface SearchFacets {
  /** "Narrow by category": leaf categories in the results (cross-category searches only). */
  categories: { id: string; slug: string; name: string; count: number }[];
  price: { min: number; max: number; selectedMin: number | null; selectedMax: number | null } | null;
  shops: FacetOption[];
  /**
   * US-055 rating filter: "N stars & up" choices with their counts (within the other filters),
   * or null when no result has a rating and none is selected.
   */
  rating: { options: { min: number; label: string; count: number; selected: boolean }[]; selected: number | null } | null;
  /** The leaf category's filterable attributes, in display order (leaf categories only). */
  attributes: AttributeFacet[];
}

export interface SearchResponse {
  /** The search as applied (filters that do not apply here are dropped). */
  params: SearchParams;
  /** "category": a leaf with its own filters; "cross": common filters + "Narrow by category". */
  mode: "category" | "cross";
  category: { id: string; slug: string; name: string; isLeaf: boolean } | null;
  items: SearchItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  facets: SearchFacets;
  engine: SearchEngine["name"];
}

export function widgetOf(field: Pick<FilterField, "type" | "widget">): FilterWidget {
  if (field.widget) return field.widget;
  if (field.type === "number") return "range_slider";
  if (field.type === "boolean") return "toggle";
  return "checkbox_list";
}

const KIND: Record<FilterWidget, FacetKind> = { checkbox_list: "values", range_slider: "range", toggle: "toggle" };
const TRUE_VALUES = new Set(["1", "true", "yes"]);

/** Attribute filters from the URL that apply to these fields; the rest are dropped. */
export function toAttrFilters(params: SearchParams, fields: FilterField[]): { filters: AttrFilter[]; applied: SearchParams["attrs"] } {
  const filters: AttrFilter[] = [];
  const applied: SearchParams["attrs"] = {};
  for (const field of fields) {
    const p = params.attrs[field.key];
    if (!p) continue;
    const widget = widgetOf(field);
    if (widget === "checkbox_list" && p.values.length > 0) {
      filters.push({ key: field.key, kind: "values", values: p.values });
      applied[field.key] = { values: p.values, min: null, max: null };
    } else if (widget === "range_slider" && (p.min !== null || p.max !== null)) {
      filters.push({ key: field.key, kind: "range", min: p.min, max: p.max });
      applied[field.key] = { values: [], min: p.min, max: p.max };
    } else if (widget === "toggle" && p.values.some((v) => TRUE_VALUES.has(v.toLowerCase()))) {
      filters.push({ key: field.key, kind: "toggle" });
      applied[field.key] = { values: ["1"], min: null, max: null };
    }
  }
  return { filters, applied };
}

const natural = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });

/**
 * Checkbox options: counts within the current results, zero-count options hidden (a selected
 * option is kept so it can be unticked), at most MAX_FACET_OPTIONS by count, shown by label.
 */
export function facetOptions(
  counts: Record<string, number>,
  selected: string[],
  labelOf: (value: string) => string,
  max = MAX_FACET_OPTIONS,
): FacetOption[] {
  const values = new Set([...Object.keys(counts).filter((v) => (counts[v] ?? 0) > 0), ...selected]);
  const ranked = [...values].sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || natural(labelOf(a), labelOf(b)));
  const kept = ranked.filter((v, i) => i < max || selected.includes(v));
  return kept
    .map((value) => ({ value, label: labelOf(value), count: counts[value] ?? 0, selected: selected.includes(value) }))
    .sort((a, b) => natural(a.label, b.label));
}

export function buildAttributeFacets(fields: FilterField[], result: EngineResult, applied: SearchParams["attrs"]): AttributeFacet[] {
  const out: AttributeFacet[] = [];
  for (const field of [...fields].sort((a, b) => a.displayOrder - b.displayOrder)) {
    const widget = widgetOf(field);
    const facet = result.facets.attrs[field.key] ?? {};
    const sel = applied[field.key];
    const base = { key: field.key, name: field.name, unit: field.unit };
    if (widget === "checkbox_list") {
      const labels = new Map(field.options.map((o) => [o.value, o.label]));
      const unit = field.type === "number" && field.unit ? ` ${field.unit}` : "";
      const options = facetOptions(facet.values ?? {}, sel?.values ?? [], (v) => labels.get(v) ?? `${v}${unit}`);
      if (options.length > 0) out.push({ ...base, widget, options });
    } else if (widget === "range_slider") {
      const range = facet.range ?? null;
      const selectedMin = sel?.min ?? null;
      const selectedMax = sel?.max ?? null;
      if (range || selectedMin !== null || selectedMax !== null) {
        out.push({
          ...base,
          widget,
          min: range?.min ?? selectedMin ?? selectedMax ?? 0,
          max: range?.max ?? selectedMax ?? selectedMin ?? 0,
          selectedMin,
          selectedMax,
        });
      }
    } else {
      const count = facet.trueCount ?? 0;
      const selected = !!sel;
      if (count > 0 || selected) out.push({ ...base, widget, count, selected });
    }
  }
  return out;
}

/** The rating filter's choices: thresholds with results (the selected one is always kept). */
export function ratingFacet(counts: Record<string, number> | undefined, selected: number | null): SearchFacets["rating"] {
  const options = RATING_THRESHOLDS.map((min) => ({
    min,
    label: `${min} ${min === 1 ? "star" : "stars"} & up`,
    count: counts?.[String(min)] ?? 0,
    selected: selected === min,
  })).filter((o) => o.count > 0 || o.selected);
  return options.length > 0 ? { options, selected } : null;
}

export function createSearchService(deps: SearchServiceDeps) {
  /** Throws SearchError: 400 for malformed parameters, 404 for an unknown category. */
  async function search(raw: RawParams): Promise<SearchResponse> {
    const parsed = parseSearchParams(raw);

    let category: CategoryInfo | null = null;
    if (parsed.category) {
      category = await deps.findCategory(parsed.category);
      if (!category || category.archivedAt) throw new SearchError(404, "CATEGORY_NOT_FOUND", "This category does not exist");
    }
    const mode = category?.isLeaf ? "category" : "cross";
    const fields = category?.isLeaf ? await deps.getFilterFields(category.id) : [];
    const { filters, applied } = toAttrFilters(parsed, fields);
    const params: SearchParams = { ...parsed, attrs: applied };

    const request: EngineRequest = {
      q: params.q,
      terms: expandQuery(params.q),
      category: category ? { id: category.id, path: category.path } : null,
      shops: params.shops,
      price: params.priceMin !== null || params.priceMax !== null ? { min: params.priceMin, max: params.priceMax } : null,
      attrs: filters,
      minRating: params.minRating,
      facets: fields.map((f) => ({ key: f.key, kind: KIND[widgetOf(f)] })),
      sort: params.sort,
      page: params.page,
      perPage: PER_PAGE,
    };
    const { result, engine } = await deps.engine.search(request);

    const categoryIds = mode === "cross" ? Object.keys(result.facets.categories).filter((id) => result.facets.categories[id] > 0) : [];
    const shopSlugs = [...new Set([...Object.keys(result.facets.shops), ...params.shops])];
    const [categories, shops] = await Promise.all([
      categoryIds.length ? deps.categoriesByIds(categoryIds) : Promise.resolve([]),
      shopSlugs.length ? deps.shopsBySlugs(shopSlugs) : Promise.resolve([]),
    ]);
    const shopNames = new Map(shops.map((s) => [s.slug, s.name]));
    for (const hit of result.hits) shopNames.set(hit.shopSlug, hit.shopName);

    const price =
      result.facets.price || request.price
        ? {
            min: result.facets.price?.min ?? params.priceMin ?? params.priceMax ?? 0,
            max: result.facets.price?.max ?? params.priceMax ?? params.priceMin ?? 0,
            selectedMin: params.priceMin,
            selectedMax: params.priceMax,
          }
        : null;

    return {
      params,
      mode,
      category: category ? { id: category.id, slug: category.slug, name: category.name, isLeaf: category.isLeaf } : null,
      items: result.hits.map((d) => ({
        id: d.id,
        title: d.title,
        bengaliName: d.bengaliName,
        priceMin: d.priceMin,
        priceMax: d.priceMax,
        shopName: d.shopName,
        shopSlug: d.shopSlug,
        categoryName: d.categoryName,
        rating: d.rating,
        ratingCount: d.ratingCount,
        imageUrl: d.coverImageId ? `/api/product-images/${d.coverImageId}` : null,
        url: `/products/${d.id}`,
      })),
      total: result.total,
      page: params.page,
      perPage: PER_PAGE,
      totalPages: Math.ceil(result.total / PER_PAGE),
      facets: {
        categories: categories
          .map((c) => ({ ...c, count: result.facets.categories[c.id] ?? 0 }))
          .filter((c) => c.count > 0)
          .sort((a, b) => b.count - a.count || natural(a.name, b.name)),
        price,
        shops: facetOptions(result.facets.shops, params.shops, (slug) => shopNames.get(slug) ?? slug),
        rating: ratingFacet(result.facets.rating, params.minRating),
        attributes: buildAttributeFacets(fields, result, applied),
      },
      engine,
    };
  }

  return { search };
}

export type SearchService = ReturnType<typeof createSearchService>;

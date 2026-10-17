import { describe, expect, it } from "vitest";
import { buildSearchDocument, ratingOf, type ProductForIndex } from "./documents";
import { createEngineSelector } from "./engine";
import { buildFilters, buildQueries, buildSort, ratingThresholds, readResults } from "./meili";
import { matchesRating, searchDocuments } from "./memory";
import { hasFilters, parseSearchParams, searchHref, EMPTY_SEARCH } from "./params";
import { createPostgresEngine } from "./postgres";
import { createSearchService, ratingFacet } from "./service";
import { doc, request } from "./test-fixtures";

// US-055 in search: the rating is in the search document, "N stars & up" filters it, the facet
// counts each threshold within the other filters, and results can be sorted by rating.

const rated = () => [
  doc({ id: "best", rating: 4.8, ratingCount: 12, createdAt: 1 }),
  doc({ id: "good", rating: 4.0, ratingCount: 3, createdAt: 2 }),
  doc({ id: "good2", rating: 4.0, ratingCount: 9, createdAt: 3 }),
  doc({ id: "meh", rating: 2.5, ratingCount: 2, createdAt: 4, shopSlug: "other" }),
  doc({ id: "new", rating: null, ratingCount: 0, createdAt: 5 }),
];

describe("search document", () => {
  const product: ProductForIndex = {
    id: "p1",
    title: "RAM",
    bengaliName: null,
    description: "",
    attributes: {},
    createdAt: new Date(0),
    shop: { id: "s1", slug: "tech", name: "Tech" },
    category: { id: "ram", slug: "ram", name: "RAM", path: "/ram/" },
    variants: [{ price: "100.00", stock: 1, options: {} }],
    images: [],
  };

  it("holds the average to 1 decimal and the review count", () => {
    expect(buildSearchDocument({ ...product, rating: { count: 3, average: { toString: () => "4.33" } } }, [])).toMatchObject({ rating: 4.3, ratingCount: 3 });
    expect(buildSearchDocument({ ...product, rating: null }, [])).toMatchObject({ rating: null, ratingCount: 0 });
    expect(buildSearchDocument(product, [])).toMatchObject({ rating: null, ratingCount: 0 });
    // An aggregate row left at 0 reviews (all hidden) counts as unrated.
    expect(ratingOf({ count: 0, average: 0 })).toEqual({ rating: null, ratingCount: 0 });
  });
});

describe("URL parameter", () => {
  it("rating=1..4 sets the minimum; anything else is a 400", () => {
    expect(parseSearchParams(new URLSearchParams("rating=4")).minRating).toBe(4);
    expect(parseSearchParams(new URLSearchParams("rating=")).minRating).toBeNull();
    for (const bad of ["5", "0", "4.5", "abc"]) expect(() => parseSearchParams(new URLSearchParams(`rating=${bad}`)), bad).toThrow();
    expect(parseSearchParams(new URLSearchParams("sort=rating")).sort).toBe("rating");
  });

  it("round-trips through links and counts as a filter", () => {
    const s = { ...EMPTY_SEARCH, q: "ram", minRating: 3 };
    expect(searchHref("/search", s)).toBe("/search?q=ram&rating=3");
    expect(hasFilters(s)).toBe(true);
    expect(hasFilters({ ...s, minRating: null })).toBe(false);
  });
});

describe("Postgres adapter (in memory)", () => {
  it("filters to rated at least N; unrated products never match", () => {
    const res = searchDocuments(rated(), request({ minRating: 4 }));
    expect(res.hits.map((d) => d.id).sort()).toEqual(["best", "good", "good2"]);
    expect(matchesRating(doc({ rating: null }), 1)).toBe(false);
    expect(matchesRating(doc({ rating: null }), null)).toBe(true);
  });

  it("counts each threshold within the other filters, but not the rating filter itself", () => {
    const res = searchDocuments(rated(), request({ minRating: 4 }));
    expect(res.facets.rating).toEqual({ "4": 3, "3": 3, "2": 4, "1": 4 });
    const shopOnly = searchDocuments(rated(), request({ shops: ["other"] }));
    expect(shopOnly.facets.rating).toEqual({ "2": 1, "1": 1 });
  });

  it("sorts by rating: best first, more reviews break ties, unrated last", () => {
    const res = searchDocuments(rated(), request({ sort: "rating" }));
    expect(res.hits.map((d) => d.id)).toEqual(["best", "good2", "good", "meh", "new"]);
  });
});

describe("Meilisearch adapter", () => {
  it("filters, sorts and facets on rating", () => {
    expect(buildFilters(request({ minRating: 3 }))).toContain("rating >= 3");
    expect(buildFilters(request({ minRating: 3 }), { rating: true })).not.toContain("rating >= 3");
    expect(buildSort(request({ sort: "rating" }))).toEqual(["rating:desc", "ratingCount:desc", "createdAt:desc"]);
    const plan = buildQueries(request({ minRating: 4 }), "products");
    expect(plan.map((p) => p.purpose.kind)).toEqual(["main", "rating"]);
    expect(plan[0].query.facets).not.toContain("rating");
    expect(plan[1].query.facets).toEqual(["rating"]);
  });

  it("turns exact ratings into threshold counts", () => {
    expect(ratingThresholds({ "4.8": 1, "4": 2, "2.5": 1 })).toEqual({ "4": 3, "3": 3, "2": 4, "1": 4 });
    const req = request({ minRating: 4 });
    const plan = buildQueries(req, "products");
    const result = readResults(req, plan, [{ hits: [], totalHits: 0 }, { facetDistribution: { rating: { "4.5": 2, "1.0": 1 } } }]);
    expect(result.facets.rating).toEqual({ "4": 2, "3": 2, "2": 2, "1": 3 });
  });
});

describe("search service", () => {
  function service() {
    const engine = createEngineSelector({ meili: null, postgres: createPostgresEngine({ loadCandidates: async () => rated() }) });
    return createSearchService({
      findCategory: async () => null,
      getFilterFields: async () => [],
      categoriesByIds: async () => [],
      shopsBySlugs: async () => [],
      engine,
    });
  }

  it("applies the rating filter and returns the rating facet and card ratings", async () => {
    const res = await service().search(new URLSearchParams("rating=4"));
    expect(res.params.minRating).toBe(4);
    expect(res.total).toBe(3);
    expect(res.items[0]).toHaveProperty("rating");
    expect(res.facets.rating).toEqual({
      selected: 4,
      options: [
        { min: 4, label: "4 stars & up", count: 3, selected: true },
        { min: 3, label: "3 stars & up", count: 3, selected: false },
        { min: 2, label: "2 stars & up", count: 4, selected: false },
        { min: 1, label: "1 star & up", count: 4, selected: false },
      ],
    });
  });

  it("hides the rating filter when nothing is rated (and nothing is selected)", () => {
    expect(ratingFacet({}, null)).toBeNull();
    expect(ratingFacet({}, 4)).toEqual({ selected: 4, options: [{ min: 4, label: "4 stars & up", count: 0, selected: true }] });
  });
});

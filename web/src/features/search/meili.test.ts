import { describe, expect, it, vi } from "vitest";
import { buildFilters, buildQueries, buildSort, createMeiliEngine, EngineUnavailableError, indexSettings, quote, readResults } from "./meili";
import { doc, request } from "./test-fixtures";

const processor = { id: "processor", path: "/e/c/processor/" };
const facets = [
  { key: "brand", kind: "values" as const },
  { key: "core_count", kind: "range" as const },
  { key: "integrated_graphics", kind: "toggle" as const },
];

describe("Meilisearch query building", () => {
  it("quotes strings safely", () => {
    expect(quote('say "hi" \\ bye')).toBe('"say \\"hi\\" \\\\ bye"');
  });

  it("turns a request into filter expressions", () => {
    const req = request({
      category: processor,
      shops: ["tech", "books"],
      price: { min: 1000, max: null },
      attrs: [
        { key: "brand", kind: "values", values: ["amd", "intel"] },
        { key: "core_count", kind: "range", min: 6, max: 12 },
        { key: "tdp_w", kind: "range", min: null, max: 65 },
        { key: "integrated_graphics", kind: "toggle" },
      ],
    });
    expect(buildFilters(req)).toEqual([
      "inStock = true",
      'categoryPath = "processor"',
      'shopSlug IN ["tech", "books"]',
      "priceMax >= 1000",
      'attrs.brand IN ["amd", "intel"]',
      "attrs.core_count 6 TO 12",
      "attrs.tdp_w <= 65",
      "attrs.integrated_graphics = true",
    ]);
    expect(buildFilters(req, { attr: "brand", shops: true, price: true })).toEqual([
      "inStock = true",
      'categoryPath = "processor"',
      "attrs.core_count 6 TO 12",
      "attrs.tdp_w <= 65",
      "attrs.integrated_graphics = true",
    ]);
  });

  it("sorts: relevance by default, newest when there are no keywords, price and newest on request", () => {
    expect(buildSort(request({ q: "ryzen" }))).toBeUndefined();
    expect(buildSort(request({ q: "" }))).toEqual(["createdAt:desc"]);
    expect(buildSort(request({ sort: "price_asc" }))).toEqual(["priceMin:asc", "createdAt:desc"]);
    expect(buildSort(request({ sort: "price_desc" }))?.[0]).toBe("priceMin:desc");
  });

  it("plans one main query plus one facet query per active filter group (disjunctive facets)", () => {
    const req = request({ q: "ryzen", category: processor, facets, shops: ["tech"], attrs: [{ key: "brand", kind: "values", values: ["amd"] }], page: 2 });
    const plan = buildQueries(req, "products");
    expect(plan.map((p) => p.purpose)).toEqual([{ kind: "main" }, { kind: "shops" }, { kind: "attr", key: "brand" }]);
    const [main, shops, brand] = plan.map((p) => p.query);
    expect(main).toMatchObject({ indexUid: "products", q: "ryzen", page: 2, hitsPerPage: 24 });
    expect(main.facets).toEqual(["categoryId", "priceMin", "priceMax", "attrs.core_count", "attrs.integrated_graphics"]);
    expect(shops).toMatchObject({ limit: 0, facets: ["shopSlug"] });
    expect(shops.filter).not.toContain('shopSlug IN ["tech"]');
    expect(brand.facets).toEqual(["attrs.brand"]);
    expect(brand.filter).not.toContain('attrs.brand IN ["amd"]');
    expect(brand.filter).toContain('shopSlug IN ["tech"]');
  });

  it("reads hits, totals and facets back", () => {
    const req = request({ category: processor, facets, attrs: [{ key: "brand", kind: "values", values: ["amd"] }] });
    const plan = buildQueries(req, "products");
    const hit = { ...doc({ id: "r5" }), indexedAt: 123 };
    const result = readResults(req, plan, [
      {
        hits: [hit],
        totalHits: 2,
        facetDistribution: { categoryId: { processor: 2 }, shopSlug: { tech: 2 }, "attrs.integrated_graphics": { true: 2, false: 0 } },
        facetStats: { priceMin: { min: 24500, max: 36500 }, priceMax: { min: 24500, max: 36500 }, "attrs.core_count": { min: 6, max: 8 } },
      },
      { facetDistribution: { "attrs.brand": { amd: 2, intel: 1 } } },
    ]);
    expect(result.total).toBe(2);
    expect(result.hits[0]).not.toHaveProperty("indexedAt");
    expect(result.facets).toEqual({
      categories: { processor: 2 },
      shops: { tech: 2 },
      price: { min: 24500, max: 36500 },
      attrs: { brand: { values: { amd: 2, intel: 1 } }, core_count: { range: { min: 6, max: 8 } }, integrated_graphics: { trueCount: 2 } },
    });
  });

  it("index settings: searchable fields, nested attribute filters, sorting and the synonyms", () => {
    const s = indexSettings();
    expect(s.searchableAttributes).toEqual(["title", "bengaliName", "brand", "keywords", "categoryNames", "description"]);
    expect(s.filterableAttributes).toEqual(expect.arrayContaining(["attrs", "categoryPath", "shopSlug", "priceMin", "priceMax", "inStock", "indexedAt"]));
    expect(s.sortableAttributes).toEqual(["priceMin", "createdAt"]);
    expect(s.synonyms.boi).toEqual(expect.arrayContaining(["book", "বই"]));
  });
});

describe("Meilisearch adapter over HTTP", () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

  it("searches with one multi-search call and the API key", async () => {
    const fetch = vi.fn(async () => ok({ results: [{ hits: [], totalHits: 0, facetDistribution: {} }] }));
    const engine = createMeiliEngine({ url: "http://meili:7700", apiKey: "key", indexName: "products", fetch });
    const res = await engine.search(request({ q: "boi" }));
    expect(res.total).toBe(0);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://meili:7700/multi-search");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer key");
    expect(JSON.parse(String(init.body)).queries[0]).toMatchObject({ indexUid: "products", q: "boi" });
  });

  it("indexes, removes and prunes stale documents", async () => {
    const fetch = vi.fn(async () => ok({ taskUid: 1 }));
    const engine = createMeiliEngine({ url: "http://m", apiKey: null, indexName: "products", fetch, now: () => 1000 });
    await engine.configure();
    await engine.upsert([doc({ id: "a" })]);
    await engine.upsert([]);
    await engine.remove(["b"]);
    await engine.remove([]);
    await engine.removeStale(999);
    const calls = (fetch.mock.calls as unknown as [string, RequestInit][]).map(([url, init]) => [init.method, url.replace("http://m", ""), init.body ? JSON.parse(String(init.body)) : undefined]);
    expect(calls[0]).toEqual(["POST", "/indexes", { uid: "products", primaryKey: "id" }]);
    expect(calls[1][0]).toBe("PATCH");
    expect(calls[1][1]).toBe("/indexes/products/settings");
    expect(calls[2]).toEqual(["PUT", "/indexes/products/documents?primaryKey=id", [expect.objectContaining({ id: "a", indexedAt: 1000 })]]);
    expect(calls[3]).toEqual(["POST", "/indexes/products/documents/delete-batch", ["b"]]);
    expect(calls[4]).toEqual(["POST", "/indexes/products/documents/delete", { filter: "indexedAt < 999" }]);
    expect(calls).toHaveLength(5);
  });

  it("reports an unreachable or failing engine as unavailable", async () => {
    const down = createMeiliEngine({ url: "http://m", apiKey: null, indexName: "p", fetch: async () => { throw new TypeError("fetch failed"); } });
    await expect(down.search(request())).rejects.toBeInstanceOf(EngineUnavailableError);
    const missing = createMeiliEngine({ url: "http://m", apiKey: null, indexName: "p", fetch: async () => new Response(JSON.stringify({ code: "index_not_found" }), { status: 404 }) });
    await expect(missing.search(request())).rejects.toThrow(/404 index_not_found/);
  });
});

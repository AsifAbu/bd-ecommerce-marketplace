import { describe, expect, it } from "vitest";
import { computeFacets, matchesAttr, matchesPrice, searchDocuments, textScore } from "./memory";
import { expandQuery } from "./synonyms";
import { doc, request, seedLikeDocs } from "./test-fixtures";

const processor = { id: "processor", path: "/electronics/components/processor/" };
const facets = [
  { key: "brand", kind: "values" as const },
  { key: "socket", kind: "values" as const },
  { key: "core_count", kind: "range" as const },
  { key: "integrated_graphics", kind: "toggle" as const },
];

describe("filters", () => {
  it("checkbox values: any selected option (OR within one filter)", () => {
    const d = doc({ attrs: { brand: ["amd"], capacity_gb: [16] } });
    expect(matchesAttr(d, { key: "brand", kind: "values", values: ["amd", "intel"] })).toBe(true);
    expect(matchesAttr(d, { key: "brand", kind: "values", values: ["intel"] })).toBe(false);
    expect(matchesAttr(d, { key: "capacity_gb", kind: "values", values: ["16"] })).toBe(true);
    expect(matchesAttr(d, { key: "colour", kind: "values", values: ["black"] })).toBe(false);
  });

  it("ranges are inclusive and open-ended; any value of a variant axis can match", () => {
    const d = doc({ attrs: { core_count: [6], size: [28, 32] } });
    expect(matchesAttr(d, { key: "core_count", kind: "range", min: 6, max: 6 })).toBe(true);
    expect(matchesAttr(d, { key: "core_count", kind: "range", min: 7, max: null })).toBe(false);
    expect(matchesAttr(d, { key: "core_count", kind: "range", min: null, max: 8 })).toBe(true);
    expect(matchesAttr(d, { key: "size", kind: "range", min: 30, max: 34 })).toBe(true);
  });

  it("toggles need the value true", () => {
    expect(matchesAttr(doc({ attrs: { otc: true } }), { key: "otc", kind: "toggle" })).toBe(true);
    expect(matchesAttr(doc({ attrs: { otc: false } }), { key: "otc", kind: "toggle" })).toBe(false);
  });

  it("price ranges overlap the product's in-stock price range", () => {
    const shirt = doc({ priceMin: 1850, priceMax: 1950 });
    expect(matchesPrice(shirt, { min: 1900, max: null })).toBe(true);
    expect(matchesPrice(shirt, { min: null, max: 1800 })).toBe(false);
    expect(matchesPrice(shirt, null)).toBe(true);
  });
});

describe("keyword relevance", () => {
  it("every word must match; title beats description; the typed word beats a synonym", () => {
    const shirt = doc({ title: "Oxford cotton shirt", bengaliName: "অক্সফোর্ড সুতি শার্ট", description: "Long sleeves" });
    expect(textScore(shirt, expandQuery("oxford shirt"))).toBeGreaterThan(0);
    expect(textScore(shirt, expandQuery("oxford panjabi"))).toBeNull();
    expect(textScore(shirt, expandQuery("jama"))).toBeGreaterThan(0); // Banglish for shirt
    expect(textScore(shirt, expandQuery("শার্ট"))).toBeGreaterThan(0);
    expect(textScore(shirt, expandQuery("shirt"))!).toBeGreaterThan(textScore(shirt, expandQuery("jama"))!);
    const inDescription = doc({ title: "Plain", description: "an oxford weave" });
    expect(textScore(shirt, expandQuery("oxford"))!).toBeGreaterThan(textScore(inDescription, expandQuery("oxford"))!);
  });

  it("category names are searchable: boi finds every book", () => {
    const [, , , himu] = seedLikeDocs();
    expect(textScore(himu, expandQuery("boi"))).toBeGreaterThan(0);
  });
});

describe("facet counts (US-042)", () => {
  it("other facets count within the current results; a filter's own options stay countable (disjunctive)", () => {
    const req = request({ category: processor, facets, attrs: [{ key: "brand", kind: "values", values: ["amd"] }] });
    const scoped = seedLikeDocs().filter((d) => d.categoryPath.includes("processor"));
    const f = computeFacets(scoped, req);
    // Brand ignores its own filter: Intel is still offered with its count.
    expect(f.attrs.brand.values).toEqual({ amd: 2, intel: 1 });
    // Socket counts only within the AMD results: LGA1700 has 0 and does not appear.
    expect(f.attrs.socket.values).toEqual({ am5: 2 });
    expect(f.attrs.core_count.range).toEqual({ min: 6, max: 8 });
    expect(f.attrs.integrated_graphics.trueCount).toBe(2);
    expect(f.categories).toEqual({ processor: 2 });
    expect(f.shops).toEqual({ tech: 2 });
    expect(f.price).toEqual({ min: 24500, max: 36500 });
  });

  it("shop and price facets leave out their own filter", () => {
    const req = request({ shops: ["books"], price: { min: null, max: 300 } });
    const f = computeFacets(seedLikeDocs(), req);
    expect(f.shops).toEqual({ books: 1 }); // price filter applies: no processor under Tk 300
    expect(f.price).toEqual({ min: 250, max: 250 }); // shop filter applies, price does not
    expect(f.categories).toEqual({ fiction: 1 });
  });

  it("an empty range facet is null", () => {
    const f = computeFacets([], request({ facets }));
    expect(f.attrs.core_count.range).toBeNull();
    expect(f.price).toBeNull();
  });
});

describe("searchDocuments", () => {
  it("scopes by category subtree, filters, sorts by relevance and pages", () => {
    const res = searchDocuments(seedLikeDocs(), request({ terms: expandQuery("processor"), category: { id: "components", path: "/electronics/components/" } }));
    expect(res.total).toBe(3);
    expect(res.hits.map((h) => h.id)).toEqual(["i5", "r7", "r5"]); // equal relevance: newest first
    const paged = searchDocuments(seedLikeDocs(), request({ perPage: 2, page: 2 }));
    expect(paged.total).toBe(4);
    expect(paged.hits).toHaveLength(2);
  });

  it("sorts by price and newest", () => {
    const ids = (sort: "price_asc" | "price_desc" | "newest") => searchDocuments(seedLikeDocs(), request({ sort })).hits.map((h) => h.id);
    expect(ids("price_asc")).toEqual(["himu", "i5", "r5", "r7"]);
    expect(ids("price_desc")).toEqual(["r7", "r5", "i5", "himu"]);
    expect(ids("newest")).toEqual(["himu", "i5", "r7", "r5"]);
  });

  it("a cross-category search counts leaf categories for 'Narrow by category'", () => {
    const res = searchDocuments(seedLikeDocs(), request({ terms: [] }));
    expect(res.facets.categories).toEqual({ processor: 3, fiction: 1 });
  });
});

import { describe, expect, it } from "vitest";
import { SearchError } from "./errors";
import { EMPTY_SEARCH, hasFilters, parseSearchParams, searchHref, toSearchParams } from "./params";

const caught = (fn: () => unknown) => {
  try {
    fn();
    return null;
  } catch (e) {
    return e;
  }
};

describe("search parameters from the URL (US-042: the URL holds the filter state)", () => {
  it("parses keywords, category, attribute filters, price, shops, sort and page", () => {
    const p = parseSearchParams(
      new URLSearchParams(
        "q=ryzen%20%20processor&category=processor&f.brand=amd&f.brand=intel&f.core_count.min=6&f.core_count.max=12&f.integrated_graphics=1&price_min=20,000&price_max=40000&shop=tech&sort=price_asc&page=2&utm_source=x",
      ),
    );
    expect(p).toEqual({
      q: "ryzen processor",
      category: "processor",
      attrs: {
        brand: { values: ["amd", "intel"], min: null, max: null },
        core_count: { values: [], min: 6, max: 12 },
        integrated_graphics: { values: ["1"], min: null, max: null },
      },
      priceMin: 20000,
      priceMax: 40000,
      shops: ["tech"],
      sort: "price_asc",
      page: 2,
    });
  });

  it("accepts the record form Next gives pages (arrays for repeated keys)", () => {
    expect(parseSearchParams({ q: "boi", "f.language": ["bangla", "english"], page: undefined })).toMatchObject({
      q: "boi",
      attrs: { language: { values: ["bangla", "english"] } },
      page: 1,
    });
  });

  it("ignores blank values (a GET form sends empty inputs) and duplicates", () => {
    expect(parseSearchParams(new URLSearchParams("q=&price_min=&f.brand=amd&f.brand=amd&shop=a&shop=a"))).toEqual({
      ...EMPTY_SEARCH,
      attrs: { brand: { values: ["amd"], min: null, max: null } },
      shops: ["a"],
    });
  });

  it("rejects malformed values with a 400 and field messages", () => {
    const err = caught(() => parseSearchParams(new URLSearchParams("price_min=cheap&page=0&sort=best&f.Brand!=x&category=Bad Slug")));
    expect(err).toBeInstanceOf(SearchError);
    expect(err).toMatchObject({
      status: 400,
      code: "INVALID_PARAMS",
      fields: {
        price_min: "Enter a number",
        page: expect.stringContaining("1 to 100"),
        sort: expect.stringContaining("relevance"),
        "f.Brand!": "Unknown filter",
        category: "Unknown category",
      },
    });
    expect(caught(() => parseSearchParams(new URLSearchParams("price_min=500&price_max=100")))).toMatchObject({ fields: { price_max: expect.any(String) } });
    expect(caught(() => parseSearchParams(new URLSearchParams("f.core_count.min=8&f.core_count.max=4")))).toMatchObject({
      fields: { "f.core_count.max": expect.any(String) },
    });
    expect(caught(() => parseSearchParams(new URLSearchParams(`q=${"x".repeat(101)}`)))).toMatchObject({ fields: { q: expect.any(String) } });
    expect(caught(() => parseSearchParams(new URLSearchParams("page=101")))).toMatchObject({ status: 400 });
  });

  it("round-trips: a link built from the state parses back to the same state", () => {
    const raw = "q=boi&category=fiction&f.language=bangla&f.page_count.min=100&price_max=500&shop=books&sort=newest&page=3";
    const p = parseSearchParams(new URLSearchParams(raw));
    expect(parseSearchParams(toSearchParams(p))).toEqual(p);
    expect(toSearchParams(EMPTY_SEARCH).toString()).toBe("");
  });

  it("builds links that change one thing and go back to page 1", () => {
    const p = parseSearchParams(new URLSearchParams("q=ryzen&category=processor&f.brand=amd&page=4"));
    expect(searchHref("/search", p, (d) => d.attrs.brand.values.push("intel"))).toBe("/search?q=ryzen&category=processor&f.brand=amd&f.brand=intel");
    expect(searchHref("/search", p, (d) => (d.attrs.brand.values = []))).toBe("/search?q=ryzen&category=processor");
    expect(searchHref("/c/processor", p, undefined, { omitCategory: true })).toBe("/c/processor?q=ryzen&f.brand=amd&page=4");
    expect(searchHref("/search", EMPTY_SEARCH)).toBe("/search");
  });

  it("knows when filters are set", () => {
    expect(hasFilters(EMPTY_SEARCH)).toBe(false);
    expect(hasFilters({ ...EMPTY_SEARCH, q: "x", sort: "newest" })).toBe(false);
    expect(hasFilters({ ...EMPTY_SEARCH, shops: ["a"] })).toBe(true);
    expect(hasFilters({ ...EMPTY_SEARCH, priceMax: 5 })).toBe(true);
  });
});

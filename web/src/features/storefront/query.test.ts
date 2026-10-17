import { describe, expect, it } from "vitest";
import { parseStorefrontQuery, sortAndPage, storefrontQueryString } from "./query";

describe("parseStorefrontQuery", () => {
  it("reads page, sort and category", () => {
    expect(parseStorefrontQuery({ page: "3", sort: "price_asc", category: "mens-shirts" })).toEqual({
      page: 3,
      sort: "price_asc",
      category: "mens-shirts",
    });
  });

  it("falls back to defaults for missing or bad values", () => {
    const defaults = { page: 1, sort: "newest", category: null };
    expect(parseStorefrontQuery({})).toEqual(defaults);
    expect(parseStorefrontQuery({ page: "0", sort: "cheap", category: "Bad Slug!" })).toEqual(defaults);
    expect(parseStorefrontQuery({ page: "-2" })).toEqual(defaults);
    expect(parseStorefrontQuery({ page: "1e9" })).toEqual(defaults);
    expect(parseStorefrontQuery({ page: ["2", "5"], sort: ["price_desc"] })).toMatchObject({ page: 2, sort: "price_desc" });
  });
});

describe("storefrontQueryString", () => {
  it("leaves out defaults", () => {
    expect(storefrontQueryString({ page: 1, sort: "newest", category: null })).toBe("");
    expect(storefrontQueryString({ page: 2, sort: "price_desc", category: "ram" })).toBe("?category=ram&sort=price_desc&page=2");
  });
});

describe("sortAndPage", () => {
  const item = (id: string, day: number, minPrice: number) => ({ id, createdAt: new Date(Date.UTC(2026, 9, day)), minPrice });
  const items = [item("a", 1, 300), item("b", 3, 100), item("c", 2, 200), item("d", 2, 100)];

  it("sorts newest first, ties stable", () => {
    expect(sortAndPage(items, "newest", 1).items.map((i) => i.id)).toEqual(["b", "c", "d", "a"]);
  });

  it("sorts by price, ties by newest", () => {
    expect(sortAndPage(items, "price_asc", 1).items.map((i) => i.id)).toEqual(["b", "d", "c", "a"]);
    expect(sortAndPage(items, "price_desc", 1).items.map((i) => i.id)).toEqual(["a", "c", "b", "d"]);
  });

  it("pages and clamps", () => {
    expect(sortAndPage(items, "newest", 2, 3)).toMatchObject({ page: 2, totalPages: 2, total: 4 });
    expect(sortAndPage(items, "newest", 2, 3).items.map((i) => i.id)).toEqual(["a"]);
    expect(sortAndPage(items, "newest", 9, 3).page).toBe(2);
    expect(sortAndPage([], "newest", 4)).toEqual({ items: [], page: 1, totalPages: 1, total: 0 });
  });
});

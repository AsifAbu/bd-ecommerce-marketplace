import { PER_PAGE } from "./config";
import type { EngineRequest, SearchDocument } from "./types";

/** Test helpers: search documents and engine requests with sensible defaults. */

let n = 0;

export function doc(overrides: Partial<SearchDocument> = {}): SearchDocument {
  n++;
  return {
    id: `p${n}`,
    title: `Product ${n}`,
    bengaliName: null,
    description: "",
    brand: null,
    keywords: "",
    shopId: "shopT",
    shopSlug: "tech",
    shopName: "Tech Shop",
    categoryId: "processor",
    categorySlug: "processor",
    categoryName: "Processor",
    categoryPath: ["electronics", "components", "processor"],
    categoryNames: ["Electronics", "Components", "Processor"],
    priceMin: 1000,
    priceMax: 1000,
    inStock: true,
    coverImageId: null,
    createdAt: n,
    rating: null,
    attrs: {},
    ...overrides,
  };
}

export function request(overrides: Partial<EngineRequest> = {}): EngineRequest {
  return {
    q: "",
    terms: [],
    category: null,
    shops: [],
    price: null,
    attrs: [],
    facets: [],
    sort: "relevance",
    page: 1,
    perPage: PER_PAGE,
    ...overrides,
  };
}

/** Three processors and a book, like the seed data. */
export function seedLikeDocs(): SearchDocument[] {
  return [
    doc({ id: "r5", title: "AMD Ryzen 5 7600 Processor", brand: "AMD", priceMin: 24500, priceMax: 24500, createdAt: 1, attrs: { brand: ["amd"], socket: ["am5"], core_count: [6], integrated_graphics: true } }),
    doc({ id: "r7", title: "AMD Ryzen 7 7700X Processor", brand: "AMD", priceMin: 36500, priceMax: 36500, createdAt: 2, attrs: { brand: ["amd"], socket: ["am5"], core_count: [8], integrated_graphics: true } }),
    doc({ id: "i5", title: "Intel Core i5-14400F Processor", brand: "Intel", priceMin: 21500, priceMax: 21500, createdAt: 3, attrs: { brand: ["intel"], socket: ["lga1700"], core_count: [10], integrated_graphics: false } }),
    doc({
      id: "himu",
      title: "Himu (paperback)",
      bengaliName: "হিমু",
      shopSlug: "books",
      shopName: "Book Shop",
      categoryId: "fiction",
      categorySlug: "fiction",
      categoryName: "Fiction",
      categoryPath: ["books", "fiction"],
      categoryNames: ["Books", "Fiction"],
      priceMin: 250,
      priceMax: 250,
      createdAt: 4,
      attrs: { language: ["bangla"] },
    }),
  ];
}

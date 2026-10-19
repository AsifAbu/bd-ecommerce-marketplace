import { describe, expect, it, vi } from "vitest";
import type { VisibleCategory } from "@/features/search/categories";
import { loadHome, type HomeDeps, type HomeProduct } from "./loader";

const cat = (id: string, name: string, count: number): VisibleCategory => ({ id, name, slug: id, isLeaf: false, count, children: [] });
const product = (id: string, categoryName = "Books"): HomeProduct => ({
  id,
  title: `Product ${id}`,
  priceMin: 100,
  priceMax: 100,
  shopName: "Shop",
  shopSlug: "shop",
  categoryName,
  imageUrl: null,
  rating: null,
});

function deps(over: Partial<HomeDeps> = {}): HomeDeps {
  return {
    categoryTree: async () => [],
    newArrivals: async () => [],
    productsUnder: async () => [],
    featuredShops: async () => [],
    ...over,
  };
}

describe("loadHome", () => {
  it("reports an empty database as empty", async () => {
    const data = await loadHome(deps());
    expect(data).toMatchObject({ isEmpty: true, categories: [], arrivals: [], rows: [], shops: [] });
  });

  it("is not empty when there are new arrivals", async () => {
    const data = await loadHome(deps({ newArrivals: async () => [product("a")] }));
    expect(data.isEmpty).toBe(false);
    expect(data.arrivals).toHaveLength(1);
  });

  it("builds one row per top category, biggest first, limited to three rows", async () => {
    const tree = [cat("e", "Electronics", 5), cat("b", "Books", 9), cat("f", "Fashion", 7), cat("m", "Medicine", 1), cat("h", "Home", 2)];
    const productsUnder = vi.fn(async (id: string) => [product(`${id}-1`)]);
    const data = await loadHome(deps({ categoryTree: async () => tree, productsUnder }));
    expect(data.categories).toHaveLength(5);
    expect(data.rows.map((r) => r.category.slug)).toEqual(["b", "f", "e"]);
    expect(productsUnder).toHaveBeenCalledTimes(3);
    expect(data.rows[0].products[0].id).toBe("b-1");
  });

  it("drops rows whose category has no products to show and categories without a count", async () => {
    const tree = [cat("e", "Electronics", 5), cat("b", "Books", 3), cat("z", "Ghost", 0)];
    const data = await loadHome(deps({ categoryTree: async () => tree, productsUnder: async (id) => (id === "e" ? [product("x")] : []) }));
    expect(data.categories.map((c) => c.id)).toEqual(["e", "b"]);
    expect(data.rows.map((r) => r.category.id)).toEqual(["e"]);
  });

  it("passes through the shops and asks only the injected (live-only) readers for products", async () => {
    const shops = [{ id: "s1", slug: "s", name: "S", verified: true, productCount: 3 }];
    const newArrivals = vi.fn(async () => [product("n")]);
    const data = await loadHome(deps({ categoryTree: async () => [cat("b", "Books", 1)], newArrivals, featuredShops: async () => shops }));
    expect(data.shops).toEqual(shops);
    expect(newArrivals).toHaveBeenCalledWith(10);
  });
});

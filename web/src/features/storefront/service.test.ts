import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type Row } from "@/lib/testing/fake-db";
import { parseStorefrontQuery } from "./query";

// US-014: the storefront loader shows one approved shop's live, in-stock products and never
// another shop's (ADR-004).
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  get prisma() {
    return state.db;
  },
}));

const { loadStorefront } = await import("./service");
const repo = await import("./repo");

const NOW = new Date("2026-10-16T12:00:00Z");
const q = (params: Record<string, string> = {}) => parseStorefrontQuery(params);
const at = (day: number) => new Date(Date.UTC(2026, 9, day));

const product = (id: string, shopId: string, categoryId: string, extra: Row = {}): Row => ({
  id,
  shopId,
  categoryId,
  title: `Product ${id}`,
  status: "active",
  deletedAt: null,
  expiresOn: null,
  createdAt: at(1),
  ...extra,
});
const variant = (productId: string, shopId: string, price: number, stock = 5): Row => ({
  id: `v-${productId}-${price}-${stock}`,
  productId,
  shopId,
  price,
  stock,
});

let db: ReturnType<typeof createFakeDb<"shop" | "category" | "product" | "productVariant" | "productImage">>;

function seed(extraProducts: Row[] = [], extraVariants: Row[] = []) {
  db = createFakeDb({
    shop: [
      { id: "A", slug: "shop-a", name: "Shop A", status: "approved", tier: "verified", medicineSuspended: false, ownerNid: "secret" },
      { id: "B", slug: "shop-b", name: "Shop B", status: "approved", tier: "basic", medicineSuspended: false },
      { id: "S", slug: "shop-s", name: "Suspended", status: "suspended", tier: "basic", medicineSuspended: false },
      { id: "P", slug: "shop-p", name: "Pending", status: "pending", tier: "basic", medicineSuspended: false },
      { id: "M", slug: "shop-m", name: "Pharmacy", status: "approved", tier: "verified", medicineSuspended: true },
    ],
    category: [
      { id: "cpu", name: "Processor", slug: "processor", requiresLicence: false },
      { id: "ram", name: "RAM", slug: "ram", requiresLicence: false },
      { id: "med", name: "Pain Relief", slug: "pain-relief", requiresLicence: true },
    ],
    product: [
      product("a-cpu", "A", "cpu", { createdAt: at(3) }),
      product("a-ram", "A", "ram", { createdAt: at(2) }),
      product("a-inactive", "A", "cpu", { status: "inactive" }),
      product("a-deleted", "A", "cpu", { deletedAt: at(5) }),
      product("a-expired", "A", "cpu", { expiresOn: at(15) }),
      product("a-sold-out", "A", "cpu"),
      product("b-cpu", "B", "cpu"),
      product("s-cpu", "S", "cpu"),
      product("p-cpu", "P", "cpu"),
      product("m-med", "M", "med"),
      product("m-other", "M", "cpu"),
      ...extraProducts,
    ],
    productVariant: [
      variant("a-cpu", "A", 24500),
      variant("a-ram", "A", 6800),
      variant("a-ram", "A", 9000),
      variant("a-ram", "A", 1, 0), // sold out: not counted in the price
      variant("a-inactive", "A", 100),
      variant("a-deleted", "A", 100),
      variant("a-expired", "A", 100),
      variant("a-sold-out", "A", 100, 0),
      variant("b-cpu", "B", 100),
      variant("s-cpu", "S", 100),
      variant("p-cpu", "P", 100),
      variant("m-med", "M", 12),
      variant("m-other", "M", 50),
      ...extraVariants,
    ],
    productImage: [
      { id: "img-a-cpu-2", productId: "a-cpu", shopId: "A", position: 1, createdAt: at(1) },
      { id: "img-a-cpu-1", productId: "a-cpu", shopId: "A", position: 0, createdAt: at(2) },
      { id: "img-b-cpu", productId: "b-cpu", shopId: "B", position: 0, createdAt: at(1) },
    ],
  });
  state.db = db;
}

beforeEach(() => seed());

describe("loadStorefront", () => {
  it("returns null for pending, suspended and unknown shops", async () => {
    expect(await loadStorefront("shop-s", q(), NOW)).toBeNull();
    expect(await loadStorefront("shop-p", q(), NOW)).toBeNull();
    expect(await loadStorefront("nope", q(), NOW)).toBeNull();
  });

  it("lists only the shop's live, in-stock products, never another shop's", async () => {
    const data = (await loadStorefront("shop-a", q(), NOW))!;
    expect(data.shop.id).toBe("A");
    expect(data.products.map((p) => p.id)).toEqual(["a-cpu", "a-ram"]);
    expect(data.total).toBe(2);
    const other = (await loadStorefront("shop-b", q(), NOW))!;
    expect(other.products.map((p) => p.id)).toEqual(["b-cpu"]);
  });

  it("hides licence-only listings of a shop whose medicine selling is suspended", async () => {
    const data = (await loadStorefront("shop-m", q(), NOW))!;
    expect(data.products.map((p) => p.id)).toEqual(["m-other"]);
  });

  it("gives the in-stock price range and the cover image", async () => {
    const data = (await loadStorefront("shop-a", q(), NOW))!;
    const ram = data.products.find((p) => p.id === "a-ram")!;
    expect([ram.minPrice, ram.maxPrice]).toEqual([6800, 9000]);
    expect(ram.coverImageId).toBeNull();
    expect(data.products.find((p) => p.id === "a-cpu")!.coverImageId).toBe("img-a-cpu-1");
  });

  it("offers only categories the shop has live products in, and filters by one", async () => {
    const data = (await loadStorefront("shop-a", q(), NOW))!;
    expect(data.categories.map((c) => [c.slug, c.count])).toEqual([
      ["processor", 1],
      ["ram", 1],
    ]);
    const filtered = (await loadStorefront("shop-a", q({ category: "ram" }), NOW))!;
    expect(filtered.category?.slug).toBe("ram");
    expect(filtered.products.map((p) => p.id)).toEqual(["a-ram"]);
    // A category the shop doesn't sell in is ignored.
    const ignored = (await loadStorefront("shop-a", q({ category: "pain-relief" }), NOW))!;
    expect(ignored.category).toBeNull();
    expect(ignored.total).toBe(2);
  });

  it("sorts by newest and by price", async () => {
    const ids = async (sort: string) => (await loadStorefront("shop-a", q({ sort }), NOW))!.products.map((p) => p.id);
    expect(await ids("newest")).toEqual(["a-cpu", "a-ram"]);
    expect(await ids("price_asc")).toEqual(["a-ram", "a-cpu"]);
    expect(await ids("price_desc")).toEqual(["a-cpu", "a-ram"]);
  });

  it("pages 24 products at a time and clamps the page", async () => {
    const many = Array.from({ length: 30 }, (_, i) => product(`bulk-${String(i).padStart(2, "0")}`, "B", "ram", { createdAt: new Date(Date.UTC(2026, 8, 1 + i)) }));
    seed(many, many.map((p) => variant(p.id as string, "B", 500)));
    const page1 = (await loadStorefront("shop-b", q(), NOW))!;
    expect([page1.total, page1.totalPages, page1.page, page1.products.length]).toEqual([31, 2, 1, 24]);
    expect(page1.products.slice(0, 2).map((p) => p.id)).toEqual(["b-cpu", "bulk-29"]);
    const page2 = (await loadStorefront("shop-b", q({ page: "2" }), NOW))!;
    expect(page2.products).toHaveLength(7);
    expect(page2.products.some((p) => page1.products.some((x) => x.id === p.id))).toBe(false);
    expect((await loadStorefront("shop-b", q({ page: "99" }), NOW))!.page).toBe(2);
  });

  it("handles a shop with no products", async () => {
    seed();
    db.product.rows.splice(0, db.product.rows.length);
    const data = (await loadStorefront("shop-a", q(), NOW))!;
    expect([data.products, data.categories, data.total, data.totalPages]).toEqual([[], [], 0, 1]);
  });
});

describe("storefront repo scoping", () => {
  it("findApprovedShop returns public fields only", async () => {
    // The fake ignores `select`, so check the query asks only for public fields.
    const spy = vi.spyOn(db.shop, "findFirst");
    await repo.findApprovedShop("shop-a");
    const arg = spy.mock.calls[0][0] as { where: Row; select: Row };
    expect(arg.where).toEqual({ slug: "shop-a", status: "approved" });
    expect(Object.keys(arg.select)).not.toContain("ownerNid");
    expect(Object.keys(arg.select)).not.toContain("ownerPhotoKey");
  });

  it("product, variant and image reads never return another shop's rows", async () => {
    expect((await repo.listProducts("A", ["a-cpu", "b-cpu"])).map((p) => p.id)).toEqual(["a-cpu"]);
    expect((await repo.listImages("A", ["a-cpu", "b-cpu"])).every((i) => i.productId === "a-cpu")).toBe(true);
    const variants = await repo.listInStockVariants("A", new Date("2026-10-16T00:00:00Z"));
    expect(new Set(variants.map((v) => v.productId))).toEqual(new Set(["a-cpu", "a-ram"]));
  });
});

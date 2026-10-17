import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "@/lib/testing/fake-db";
import { TODAY } from "./test-fixtures";
import type { ProductInput } from "./validation";

// Shop-scoped repositories (ADR-004): calls scoped to shop A never read or change shop B's data.
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  get prisma() {
    return state.db;
  },
}));

const repo = await import("./repo");

const product = (id: string, shopId: string, extra: Record<string, unknown> = {}) => ({
  id,
  shopId,
  categoryId: "cat",
  title: `Product ${id}`,
  status: "active",
  expiresOn: null,
  deletedAt: null,
  ...extra,
});

let db: ReturnType<typeof createFakeDb<"shop" | "shopLicence" | "category" | "product" | "productVariant" | "productImage">>;

beforeEach(() => {
  db = createFakeDb({
    shop: [
      { id: "A", status: "approved", medicineSuspended: false, tier: "basic" },
      { id: "B", status: "approved", medicineSuspended: false, tier: "basic" },
    ],
    shopLicence: [
      { id: "lA", shopId: "A", status: "verified", expiryDate: TODAY },
      { id: "lB", shopId: "B", status: "verified", expiryDate: TODAY },
    ],
    category: [{ id: "cat", requiresLicence: false, liveProductCount: 0 }],
    product: [product("pA", "A"), product("pB", "B"), product("pA-gone", "A", { deletedAt: new Date() })],
    productVariant: [
      { id: "vA", productId: "pA", shopId: "A", sku: "SKU-A", stock: 1, optionKey: "" },
      { id: "vB", productId: "pB", shopId: "B", sku: "SKU-B", stock: 1, optionKey: "" },
    ],
    productImage: [
      { id: "iA", productId: "pA", shopId: "A", storageKey: "products/A/pA/1.png", position: 0 },
      { id: "iB", productId: "pB", shopId: "B", storageKey: "products/B/pB/1.png", position: 0 },
    ],
  });
  state.db = db;
});

const input = (sku: string | null = "NEW-1"): ProductInput => ({
  title: "Edited",
  bengaliName: null,
  description: "Desc",
  attributes: { brand: "amd" },
  variants: [{ sku, price: "10.00", stock: 2, options: {}, optionKey: "", position: 0 }],
  expiresOn: null,
});
const row = (table: { rows: Record<string, unknown>[] }, id: string) => table.rows.find((r) => r.id === id)!;

describe("shop-scoped reads", () => {
  it("getListingShop returns only the scoped shop and its licences", async () => {
    const shop = await repo.getListingShop("A");
    expect(shop?.id).toBe("A");
    expect(shop?.licences).toHaveLength(1);
    expect(await repo.getListingShop("missing")).toBeNull();
  });

  it("listProducts returns the shop's products, never another shop's or deleted ones", async () => {
    expect((await repo.listProducts("A")).map((p) => p.id)).toEqual(["pA"]);
  });

  it("getProduct does not return another shop's product", async () => {
    expect((await repo.getProduct("A", "pA"))?.id).toBe("pA");
    expect(await repo.getProduct("A", "pB")).toBeNull();
    expect(await repo.getProduct("A", "pA-gone")).toBeNull();
  });

  it("countLiveListings counts only the shop's live products", async () => {
    expect(await repo.countLiveListings("A", TODAY)).toBe(1);
    expect(await repo.countLiveListings("A", TODAY, "pA")).toBe(0);
  });

  it("findTakenSkus only sees the shop's own SKUs", async () => {
    expect(await repo.findTakenSkus("A", ["SKU-A", "SKU-B"])).toEqual(["SKU-A"]);
    expect(await repo.findTakenSkus("A", ["SKU-A"], "pA")).toEqual([]);
  });

  it("countImages is scoped", async () => {
    expect(await repo.countImages("A", "pB")).toBe(0);
  });
});

describe("shop-scoped writes", () => {
  it("createProduct stores the product, its variants and an audit entry, and recounts the leaf", async () => {
    const created = await repo.createProduct("A", "cat", input(), "staffA", TODAY);
    expect(row(db.product, created.id)).toMatchObject({ shopId: "A", createdById: "staffA" });
    expect(db.productVariant.rows.filter((v) => v.productId === created.id)).toMatchObject([{ shopId: "A", sku: "NEW-1" }]);
    expect(db.auditLog.rows).toMatchObject([{ action: "product.created", entityId: created.id }]);
    expect(row(db.category, "cat").liveProductCount).toBe(3);
  });

  it("createProducts creates every product", async () => {
    await repo.createProducts("A", "cat", [input("X1"), input("X2")], "staffA", TODAY);
    expect(db.product.rows.filter((p) => p.shopId === "A")).toHaveLength(4);
  });

  it("updateProduct can't touch another shop's product", async () => {
    await expect(repo.updateProduct("A", "pB", input(), "staffA", TODAY)).rejects.toMatchObject({ status: 404 });
    expect(row(db.product, "pB").title).toBe("Product pB");
  });

  it("updateProduct keeps, adds and removes variants by id within the product", async () => {
    const next = input();
    next.variants = [
      { id: "vA", sku: "SKU-A2", price: "11.00", stock: 5, options: {}, optionKey: "", position: 0 },
    ];
    await repo.updateProduct("A", "pA", next, "staffA", TODAY);
    expect(row(db.product, "pA").title).toBe("Edited");
    expect(row(db.productVariant, "vA")).toMatchObject({ sku: "SKU-A2", stock: 5, optionKey: "" });
    // Another shop's variant id is rejected, not moved.
    const stolen = input();
    stolen.variants[0].id = "vB";
    await expect(repo.updateProduct("A", "pA", stolen, "staffA", TODAY)).rejects.toMatchObject({
      status: 422,
      fields: { "variants.0.id": "This variant does not belong to the product" },
    });
    expect(row(db.productVariant, "vB")).toMatchObject({ productId: "pB", sku: "SKU-B" });
  });

  it("setStatus changes only the scoped shop's product", async () => {
    await expect(repo.setStatus("A", "pB", "inactive", "staffA", TODAY)).rejects.toMatchObject({ status: 404 });
    await repo.setStatus("A", "pA", "inactive", "staffA", TODAY);
    expect(row(db.product, "pA").status).toBe("inactive");
    expect(row(db.product, "pB").status).toBe("active");
    expect(row(db.category, "cat").liveProductCount).toBe(1);
  });

  it("softDeleteProduct keeps the row, frees its SKUs and leaves other shops alone", async () => {
    await expect(repo.softDeleteProduct("A", "pB", "staffA", TODAY)).rejects.toMatchObject({ status: 404 });
    await repo.softDeleteProduct("A", "pA", "staffA", TODAY);
    expect(row(db.product, "pA").deletedAt).toBeInstanceOf(Date);
    expect(row(db.productVariant, "vA").sku).toBeNull();
    expect(row(db.productVariant, "vB").sku).toBe("SKU-B");
    expect(db.auditLog.rows.at(-1)).toMatchObject({ action: "product.deleted", data: { skus: ["SKU-A"] } });
  });

  it("updateVariantStock can't change another shop's variant", async () => {
    await expect(repo.updateVariantStock("A", "pB", "vB", 9, "staffA")).rejects.toMatchObject({ status: 404 });
    await expect(repo.updateVariantStock("A", "pA", "vB", 9, "staffA")).rejects.toMatchObject({ status: 404 });
    await repo.updateVariantStock("A", "pA", "vA", 9, "staffA");
    expect(row(db.productVariant, "vA").stock).toBe(9);
    expect(row(db.productVariant, "vB").stock).toBe(1);
  });
});

describe("images", () => {
  it("addImage adds to the scoped product only, after the existing images", async () => {
    await expect(repo.addImage("A", "pB", { storageKey: "k", contentType: "image/png" }, "staffA")).rejects.toMatchObject({ status: 404 });
    const img = await repo.addImage("A", "pA", { storageKey: "k", contentType: "image/png" }, "staffA");
    expect(row(db.productImage, img.id)).toMatchObject({ shopId: "A", position: 1 });
  });

  it("addImage refuses a 9th image", async () => {
    for (let i = 0; i < 7; i++) await repo.addImage("A", "pA", { storageKey: `k${i}`, contentType: "image/png" }, "staffA");
    await expect(repo.addImage("A", "pA", { storageKey: "k9", contentType: "image/png" }, "staffA")).rejects.toMatchObject({
      code: "TOO_MANY_IMAGES",
    });
  });

  it("deleteImage and makeCoverImage can't touch another shop's image", async () => {
    await expect(repo.deleteImage("A", "pB", "iB", "staffA")).rejects.toMatchObject({ status: 404 });
    await expect(repo.deleteImage("A", "pA", "iB", "staffA")).rejects.toMatchObject({ status: 404 });
    await expect(repo.makeCoverImage("A", "pA", "iB", "staffA")).rejects.toMatchObject({ status: 404 });
    expect(db.productImage.rows).toHaveLength(2);
    expect((await repo.deleteImage("A", "pA", "iA", "staffA")).storageKey).toBe("products/A/pA/1.png");
    expect(db.productImage.rows.map((i) => i.id)).toEqual(["iB"]);
  });

  it("makeCoverImage moves the image before the others", async () => {
    const second = await repo.addImage("A", "pA", { storageKey: "k", contentType: "image/png" }, "staffA");
    await repo.makeCoverImage("A", "pA", second.id, "staffA");
    expect(row(db.productImage, second.id).position).toBe(-1);
  });

  it("publicFindImage hides images of deleted products", async () => {
    expect(await repo.publicFindImage("iA")).toMatchObject({ id: "iA" });
    row(db.product, "pA").deletedAt = new Date();
    expect(await repo.publicFindImage("iA")).toBeNull();
  });
});

describe("product page reads (US-044)", () => {
  it("publicFindLiveProduct returns only live listings", async () => {
    expect(await repo.publicFindLiveProduct("pA", TODAY)).toMatchObject({ id: "pA" });
    expect(await repo.publicFindLiveProduct("pA-gone", TODAY)).toBeNull(); // deleted

    row(db.product, "pA").status = "inactive";
    expect(await repo.publicFindLiveProduct("pA", TODAY)).toBeNull();
    row(db.product, "pA").status = "active";

    row(db.product, "pA").expiresOn = new Date("2026-10-15T00:00:00Z"); // expired yesterday
    expect(await repo.publicFindLiveProduct("pA", TODAY)).toBeNull();
    row(db.product, "pA").expiresOn = TODAY; // expires today: still sold
    expect(await repo.publicFindLiveProduct("pA", TODAY)).toMatchObject({ id: "pA" });

    row(db.shop, "A").status = "suspended";
    expect(await repo.publicFindLiveProduct("pA", TODAY)).toBeNull();
    row(db.shop, "A").status = "approved";

    // Medicine listing of a shop whose medicine selling is suspended.
    row(db.category, "cat").requiresLicence = true;
    row(db.shop, "A").medicineSuspended = true;
    expect(await repo.publicFindLiveProduct("pA", TODAY)).toBeNull();
  });

  it("publicFindCategories returns the requested categories", async () => {
    expect((await repo.publicFindCategories(["cat"])).map((c) => c.id)).toEqual(["cat"]);
    expect(await repo.publicFindCategories(["missing"])).toEqual([]);
  });
});

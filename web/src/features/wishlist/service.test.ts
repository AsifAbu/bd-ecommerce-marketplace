import { beforeEach, describe, expect, it, vi } from "vitest";
import { NOW, shirtSchema, TODAY } from "@/features/products/test-fixtures";
import { WishlistError } from "./errors";
import { createWishlistService, itemState, MAX_WISHLIST_ITEMS, type CartLine, type WishlistRepo, type WishlistRow } from "./service";

// US-057 rules with an in-memory repo scoped by userId like repo.ts.

type Product = WishlistRow["product"];

const shirt = (overrides: Partial<Product> = {}): Product => ({
  id: "p-shirt",
  title: "Oxford cotton shirt",
  categoryId: "cat-shirts",
  status: "active",
  deletedAt: null,
  expiresOn: null,
  shop: { name: "Test Fashion Shop", status: "approved", medicineSuspended: false },
  category: { requiresLicence: false },
  variants: [
    { id: "v-m-black", price: "1850.00", stock: 6, options: { size: "m", colour: "black" } },
    { id: "v-l-white", price: "1950.00", stock: 0, options: { size: "l", colour: "white" } },
  ],
  images: [{ id: "img-1" }],
  ...overrides,
});

const book = (overrides: Partial<Product> = {}): Product => ({
  ...shirt(),
  id: "p-book",
  title: "Himu",
  categoryId: "cat-fiction",
  variants: [{ id: "v-book", price: "250.00", stock: 40, options: {} }],
  images: [],
  ...overrides,
});

let products: Map<string, Product>;
let items: { id: string; userId: string; productId: string; variantId: string | null; createdAt: Date }[];
let seq: number;

function fakeRepo(): WishlistRepo {
  const view = (i: (typeof items)[number]): WishlistRow => ({ ...i, product: products.get(i.productId)! });
  return {
    listItems: async (userId) => items.filter((i) => i.userId === userId).map(view).reverse(),
    getItem: async (userId, itemId) => {
      const i = items.find((x) => x.id === itemId && x.userId === userId);
      return i ? view(i) : null;
    },
    countItems: async (userId) => items.filter((i) => i.userId === userId).length,
    findForProduct: async (userId, productId) =>
      items.filter((i) => i.userId === userId && i.productId === productId).map(({ id, variantId }) => ({ id, variantId })),
    findSame: async (userId, productId, variantId) =>
      items.find((i) => i.userId === userId && i.productId === productId && i.variantId === variantId) ?? null,
    createItem: async (userId, productId, variantId) => {
      const row = { id: `w${++seq}`, userId, productId, variantId, createdAt: new Date(NOW.getTime() + seq) };
      items.push(row);
      return row;
    },
    deleteItem: async (userId, itemId) => {
      const before = items.length;
      items = items.filter((i) => !(i.id === itemId && i.userId === userId));
      return items.length < before;
    },
    findLiveProduct: async (productId) => {
      const p = products.get(productId);
      return p && p.status === "active" && !p.deletedAt ? { id: p.id, variants: p.variants.map((v) => ({ id: v.id })) } : null;
    },
  };
}

const service = () =>
  createWishlistService({
    repo: fakeRepo(),
    getCategorySchema: async (id) => {
      if (id === "cat-shirts") return shirtSchema();
      throw new Error("no schema");
    },
    now: () => NOW,
  });

beforeEach(() => {
  products = new Map([
    ["p-shirt", shirt()],
    ["p-book", book()],
  ]);
  items = [];
  seq = 0;
});

describe("addItem", () => {
  it("saves a product with the chosen variant, once", async () => {
    const s = service();
    const first = await s.addItem("u1", { productId: "p-shirt", variantId: "v-m-black" });
    expect(first).toMatchObject({ created: true, item: { variantId: "v-m-black" } });
    const again = await s.addItem("u1", { productId: "p-shirt", variantId: "v-m-black" });
    expect(again).toMatchObject({ created: false, item: { id: first.item.id } });
    expect(items).toHaveLength(1);
  });

  it("can save without a variant, and picks the only variant of a product without options", async () => {
    const s = service();
    expect((await s.addItem("u1", { productId: "p-shirt" })).item.variantId).toBeNull();
    expect((await s.addItem("u1", { productId: "p-shirt", variantId: null })).created).toBe(false);
    expect((await s.addItem("u1", { productId: "p-book" })).item.variantId).toBe("v-book");
  });

  it("allows out-of-stock variants (the customer waits for restock)", async () => {
    expect((await service().addItem("u1", { productId: "p-shirt", variantId: "v-l-white" })).created).toBe(true);
  });

  it("rejects unknown or hidden products and foreign variants", async () => {
    const s = service();
    await expect(s.addItem("u1", {})).rejects.toMatchObject({ status: 422, fields: { productId: "Choose a product" } });
    await expect(s.addItem("u1", "nope")).rejects.toMatchObject({ status: 422 });
    await expect(s.addItem("u1", { productId: "missing" })).rejects.toMatchObject({ status: 404 });
    products.set("p-shirt", shirt({ status: "inactive" }));
    await expect(s.addItem("u1", { productId: "p-shirt" })).rejects.toMatchObject({ status: 404 });
    await expect(s.addItem("u1", { productId: "p-book", variantId: "v-m-black" })).rejects.toMatchObject({
      status: 422,
      fields: { variantId: expect.any(String) },
    });
    await expect(s.addItem("u1", { productId: "p-book", variantId: 42 })).rejects.toMatchObject({ status: 422 });
  });

  it("limits the wishlist size", async () => {
    for (let i = 0; i < MAX_WISHLIST_ITEMS; i++) items.push({ id: `x${i}`, userId: "u1", productId: "p-book", variantId: `old-${i}`, createdAt: NOW });
    await expect(service().addItem("u1", { productId: "p-shirt" })).rejects.toMatchObject({ status: 409, code: "WISHLIST_FULL" });
    // Another user is not affected.
    expect((await service().addItem("u2", { productId: "p-shirt" })).created).toBe(true);
  });
});

describe("listItems", () => {
  it("shows price, variant and stock for the user's items only, newest first", async () => {
    const s = service();
    await s.addItem("u1", { productId: "p-shirt", variantId: "v-m-black" });
    await s.addItem("u1", { productId: "p-book" });
    await s.addItem("u2", { productId: "p-shirt", variantId: "v-l-white" });
    const list = await s.listItems("u1");
    expect(list.map((i) => i.productId)).toEqual(["p-book", "p-shirt"]);
    expect(list[1]).toMatchObject({
      title: "Oxford cotton shirt",
      href: "/products/p-shirt?variant=v-m-black",
      variantLabel: "Size: M, Colour: Black",
      priceText: "Tk 1,850",
      statusLabel: "In stock",
      canMoveToCart: true,
      imageId: "img-1",
      shopName: "Test Fashion Shop",
    });
    expect(list[0]).toMatchObject({ variantLabel: null, priceText: "Tk 250", canMoveToCart: true, imageId: null });
  });

  it("shows Out of stock for an out-of-stock variant, all variants out, or a listing no longer live", async () => {
    const s = service();
    await s.addItem("u1", { productId: "p-shirt", variantId: "v-l-white" });
    expect((await s.listItems("u1"))[0]).toMatchObject({ statusLabel: "Out of stock", canMoveToCart: false, moveHint: "Out of stock" });

    items = [];
    await s.addItem("u1", { productId: "p-shirt" });
    expect((await s.listItems("u1"))[0]).toMatchObject({
      statusLabel: "In stock",
      priceText: "Tk 1,850 – Tk 1,950",
      canMoveToCart: false,
      moveHint: "Choose a variant on the product page first",
    });
    products.set("p-shirt", shirt({ variants: shirt().variants.map((v) => ({ ...v, stock: 0 })) }));
    expect((await s.listItems("u1"))[0]).toMatchObject({ statusLabel: "Out of stock", canMoveToCart: false });

    products.set("p-shirt", shirt({ expiresOn: new Date("2026-10-01T00:00:00Z") }));
    expect((await s.listItems("u1"))[0]).toMatchObject({ statusLabel: "Out of stock", moveHint: "No longer available" });
  });

  it("falls back to raw option names when the category schema can't load", async () => {
    products.set("p-book", book({ variants: [{ id: "v-book", price: "250.00", stock: 1, options: { format: "paperback" } }] }));
    const s = service();
    await s.addItem("u1", { productId: "p-book" });
    expect((await s.listItems("u1"))[0].variantLabel).toBe("format: paperback");
  });
});

describe("removeItem", () => {
  it("removes the user's own item and 404s for another user's", async () => {
    const s = service();
    const { item } = await s.addItem("u1", { productId: "p-book" });
    await expect(s.removeItem("u2", item.id)).rejects.toMatchObject({ status: 404 });
    expect(items).toHaveLength(1);
    await s.removeItem("u1", item.id);
    expect(items).toHaveLength(0);
    await expect(s.removeItem("u1", item.id)).rejects.toBeInstanceOf(WishlistError);
  });
});

describe("moveToCart", () => {
  const adder = () => vi.fn<(line: CartLine) => Promise<undefined>>(async () => undefined);

  it("adds the chosen variant to the cart and removes it from the wishlist", async () => {
    const s = service();
    const { item } = await s.addItem("u1", { productId: "p-shirt", variantId: "v-m-black" });
    const add = adder();
    expect(await s.moveToCart("u1", item.id, add)).toEqual({ productId: "p-shirt", variantId: "v-m-black" });
    expect(add).toHaveBeenCalledWith({ userId: "u1", productId: "p-shirt", variantId: "v-m-black", quantity: 1 });
    expect(items).toHaveLength(0);
  });

  it("uses the only variant of a product without options", async () => {
    const s = service();
    const { item } = await s.addItem("u1", { productId: "p-book" });
    const add = adder();
    await s.moveToCart("u1", item.id, add, { quantity: 2 });
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ variantId: "v-book", quantity: 2 }));
  });

  it("requires a variant to be chosen, and accepts one chosen now", async () => {
    const s = service();
    const { item } = await s.addItem("u1", { productId: "p-shirt" });
    const add = adder();
    await expect(s.moveToCart("u1", item.id, add)).rejects.toMatchObject({ status: 422, code: "VARIANT_REQUIRED" });
    await expect(s.moveToCart("u1", item.id, add, { variantId: "v-book" })).rejects.toMatchObject({ status: 422 });
    expect(add).not.toHaveBeenCalled();
    await s.moveToCart("u1", item.id, add, { variantId: "v-m-black" });
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ variantId: "v-m-black" }));
    expect(items).toHaveLength(0);
  });

  it("refuses out-of-stock and no-longer-live items and keeps them in the wishlist", async () => {
    const s = service();
    const { item } = await s.addItem("u1", { productId: "p-shirt", variantId: "v-l-white" });
    const add = adder();
    await expect(s.moveToCart("u1", item.id, add)).rejects.toMatchObject({ status: 409, code: "OUT_OF_STOCK" });
    products.set("p-shirt", shirt({ deletedAt: new Date() }));
    await expect(s.moveToCart("u1", item.id, add, { variantId: "v-m-black" })).rejects.toMatchObject({ status: 409, code: "UNAVAILABLE" });
    expect(add).not.toHaveBeenCalled();
    expect(items).toHaveLength(1);
  });

  it("keeps the item when the cart refuses it", async () => {
    const s = service();
    const { item } = await s.addItem("u1", { productId: "p-book" });
    const failing = vi.fn(async () => {
      throw new Error("cart full");
    });
    await expect(s.moveToCart("u1", item.id, failing)).rejects.toThrow("cart full");
    expect(items).toHaveLength(1);
  });

  it("can't move another user's item", async () => {
    const s = service();
    const { item } = await s.addItem("u1", { productId: "p-book" });
    const add = adder();
    await expect(s.moveToCart("u2", item.id, add)).rejects.toMatchObject({ status: 404 });
    expect(add).not.toHaveBeenCalled();
    await expect(s.moveToCart("u1", item.id, add, { quantity: 0 })).rejects.toMatchObject({ status: 422 });
  });
});

describe("itemState", () => {
  it("is live-aware for medicine suspension", () => {
    const row: WishlistRow = {
      id: "w",
      userId: "u1",
      productId: "p-book",
      variantId: "v-book",
      createdAt: NOW,
      product: book({ category: { requiresLicence: true }, shop: { name: "Pharmacy", status: "approved", medicineSuspended: true } }),
    };
    expect(itemState(row, TODAY)).toEqual({ status: "out_of_stock", canMoveToCart: false, moveHint: "No longer available" });
  });
});

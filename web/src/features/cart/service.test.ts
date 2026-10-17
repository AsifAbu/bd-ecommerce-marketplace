import { describe, expect, it } from "vitest";
import type { CategorySchema } from "@/features/catalog";
import { CartError } from "./errors";
import { cartReadyForCheckout, MAX_CART_LINES } from "./model";
import { createCartService, type CartOwner } from "./service";
import { bookShop, createMemoryRepo, techShop, TODAY, type FakeVariant } from "./test-fixtures";

const ram: FakeVariant = { id: "v-ram", productId: "p-ram", shop: techShop, title: "RAM", price: "6800.00", stock: 25, weightG: 250 };
const book: FakeVariant = { id: "v-book", productId: "p-book", shop: bookShop, title: "Maths", price: "650.00", stock: 3, weightG: 250 };
const novel: FakeVariant = { id: "v-novel", productId: "p-novel", shop: bookShop, title: "Himu", price: "250.00", stock: 40, weightG: 250 };
const shirt: FakeVariant = {
  id: "v-shirt-m",
  productId: "p-shirt",
  shop: bookShop,
  title: "Shirt",
  price: "1850.00",
  stock: 6,
  options: { size: "m", colour: "black" },
};
const soldOut: FakeVariant = { id: "v-sold", productId: "p-sold", shop: bookShop, title: "Sold", price: "100", stock: 0 };
const hidden: FakeVariant = { id: "v-hidden", productId: "p-hidden", shop: bookShop, title: "Hidden", price: "100", stock: 5, live: false };

const alice: CartOwner = { kind: "user", userId: "alice" };
const bob: CartOwner = { kind: "user", userId: "bob" };
const guest: CartOwner = { kind: "guest", guestToken: "g-token" };
const otherGuest: CartOwner = { kind: "guest", guestToken: "g-other" };

const schema: CategorySchema = {
  categoryId: "cat-1",
  name: "Shirts",
  isOther: false,
  requiresLicence: false,
  requiresExpiry: false,
  fields: [
    { key: "size", name: "Size", isVariantAxis: true, options: [{ value: "m", label: "M" }] },
    { key: "colour", name: "Colour", isVariantAxis: true, options: [{ value: "black", label: "Black" }] },
  ] as unknown as CategorySchema["fields"],
};

function setup() {
  let t = Date.UTC(2026, 9, 16, 6, 0, 0);
  const clock = () => new Date((t += 1000));
  const mem = createMemoryRepo([ram, book, novel, shirt, soldOut, hidden], clock);
  const service = createCartService({ repo: mem.repo, getCategorySchema: async () => schema, now: () => TODAY });
  return { ...mem, service };
}

async function rejects(p: Promise<unknown>, status: number, code: string) {
  const err = await p.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(CartError);
  expect(err).toMatchObject({ status, code });
}

describe("addItem (US-050)", () => {
  it("adds a live, in-stock variant at its current price; guests too", async () => {
    const { service, rows } = setup();
    const r = await service.addItem(guest, { variantId: "v-ram", quantity: 2 });
    expect(r).toMatchObject({ created: true, capped: false, message: "Added to your cart.", item: { quantity: 2, savedForLater: false } });
    expect(rows[0]).toMatchObject({ guestToken: "g-token", userId: null, shopId: "shop-tech", productId: "p-ram", priceAtAdd: "6800.00" });
  });

  it("defaults to quantity 1 and adds to an existing line", async () => {
    const { service } = setup();
    await service.addItem(alice, { variantId: "v-novel" });
    const r = await service.addItem(alice, { variantId: "v-novel", quantity: 2 });
    expect(r).toMatchObject({ created: false, item: { quantity: 3 }, message: "Added. You now have 3 in your cart." });
    expect(await service.countItems(alice)).toBe(3);
  });

  it("caps the quantity at the stock with a message (3 in stock, 5 asked)", async () => {
    const { service } = setup();
    const r = await service.addItem(alice, { variantId: "v-book", quantity: 5 });
    expect(r).toMatchObject({ capped: true, item: { quantity: 3 }, message: "Only 3 in stock. Quantity set to 3. Added to your cart." });
    const again = await service.addItem(alice, { variantId: "v-book", quantity: 1 });
    expect(again).toMatchObject({ capped: true, item: { quantity: 3 }, message: "You already have 3 in your cart, the most you can buy now." });
  });

  it("needs a variant, a whole quantity, a live listing and stock", async () => {
    const { service } = setup();
    await rejects(service.addItem(alice, { quantity: 1 }), 422, "VARIANT_REQUIRED");
    await rejects(service.addItem(alice, { variantId: "v-ram", quantity: 0 }), 422, "VALIDATION");
    await rejects(service.addItem(alice, { variantId: "v-ram", quantity: 1.5 }), 422, "VALIDATION");
    await rejects(service.addItem(alice, { variantId: "v-ram", quantity: "2" }), 422, "VALIDATION");
    await rejects(service.addItem(alice, { variantId: "v-hidden" }), 404, "NOT_FOUND");
    await rejects(service.addItem(alice, { variantId: "nope" }), 404, "NOT_FOUND");
    await rejects(service.addItem(alice, { variantId: "v-sold" }), 409, "OUT_OF_STOCK");
  });

  it("re-adding a line saved for later brings it back to the cart at the current price", async () => {
    const { service, insert } = setup();
    const row = insert(alice, "v-novel", { savedForLater: true, priceAtAdd: "200.00", quantity: 1 });
    await service.addItem(alice, { variantId: "v-novel" });
    expect(row).toMatchObject({ savedForLater: false, quantity: 2, priceAtAdd: "250.00" });
  });

  it("refuses a new line when the cart is full", async () => {
    const { service, insert } = setup();
    for (let i = 0; i < MAX_CART_LINES; i++) insert(alice, `v-ram`, { variantId: `x-${i}` });
    await rejects(service.addItem(alice, { variantId: "v-novel" }), 409, "CART_FULL");
  });
});

describe("getCart (US-050, US-056, US-058)", () => {
  it("groups by shop with delivery for the zone and labels variants from the schema", async () => {
    const { service } = setup();
    await service.addItem(alice, { variantId: "v-ram" });
    await service.addItem(alice, { variantId: "v-shirt-m" });
    await service.addItem(alice, { variantId: "v-novel", quantity: 2 });
    const cart = await service.getCart(alice, "outside_dhaka");
    expect(cart.groups.map((g) => [g.shop.name, g.subtotal, g.deliveryCharge])).toEqual([
      ["Tech Shop", 6800, 130],
      ["Book Shop", 2350, 130],
    ]);
    expect(cart.groups[0].amountForFreeDelivery).toBe(3200);
    expect(cart.groups[1].lines.find((l) => l.variantId === "v-shirt-m")?.variantLabel).toBe("Size: M, Colour: Black");
    expect(cart.grandTotal).toBe(9410);
  });

  it("saves a quantity lowered to the stock", async () => {
    const { service, insert } = setup();
    const row = insert(alice, "v-book", { quantity: 5 });
    const cart = await service.getCart(alice, "inside_dhaka");
    expect(cart.groups[0].lines[0].quantity).toBe(3);
    expect(row.quantity).toBe(3);
  });

  it("only returns the owner's rows", async () => {
    const { service, insert } = setup();
    insert(alice, "v-ram");
    insert(bob, "v-novel");
    insert(guest, "v-book");
    expect((await service.getCart(alice, "inside_dhaka")).groups.flatMap((g) => g.lines.map((l) => l.variantId))).toEqual(["v-ram"]);
    expect((await service.getCart(guest, "inside_dhaka")).groups.flatMap((g) => g.lines.map((l) => l.variantId))).toEqual(["v-book"]);
    expect((await service.getCart(otherGuest, "inside_dhaka")).groups).toEqual([]);
  });
});

describe("updateItem (US-056)", () => {
  it("sets the quantity, capped at the stock with a message", async () => {
    const { service, insert } = setup();
    const row = insert(alice, "v-book", { quantity: 1 });
    expect(await service.updateItem(alice, row.id, { quantity: 2 })).toMatchObject({ capped: false, message: "Quantity set to 2." });
    const r = await service.updateItem(alice, row.id, { quantity: 5 });
    expect(r).toMatchObject({ capped: true, item: { quantity: 3 }, message: "Only 3 in stock. Quantity set to 3." });
    expect(row.quantity).toBe(3);
  });

  it("rejects a bad quantity and an empty change", async () => {
    const { service, insert } = setup();
    const row = insert(alice, "v-book");
    await rejects(service.updateItem(alice, row.id, { quantity: 0 }), 422, "VALIDATION");
    await rejects(service.updateItem(alice, row.id, { savedForLater: "yes" }), 422, "VALIDATION");
    await rejects(service.updateItem(alice, row.id, {}), 422, "VALIDATION");
  });

  it("can't change the quantity of an out-of-stock item", async () => {
    const { service, insert } = setup();
    const row = insert(alice, "v-sold");
    await rejects(service.updateItem(alice, row.id, { quantity: 2 }), 409, "OUT_OF_STOCK");
  });

  it("save for later takes the line out of the totals; moving back caps it at the stock", async () => {
    const { service, insert } = setup();
    insert(alice, "v-ram");
    const row = insert(alice, "v-book", { quantity: 2 });
    const saved = await service.updateItem(alice, row.id, { savedForLater: true });
    expect(saved.message).toBe("Saved for later. It is no longer in your cart totals.");
    let cart = await service.getCart(alice, "inside_dhaka");
    expect(cart.saved.map((l) => l.id)).toEqual([row.id]);
    expect(cart.subtotal).toBe(6800);
    expect(await service.countItems(alice)).toBe(1);

    row.quantity = 7; // as if stored long ago
    const back = await service.updateItem(alice, row.id, { savedForLater: false });
    expect(back).toMatchObject({ capped: true, item: { quantity: 3, savedForLater: false } });
    expect(back.message).toBe("Only 3 in stock. Quantity set to 3. Moved back to your cart.");
    cart = await service.getCart(alice, "inside_dhaka");
    expect(cart.saved).toEqual([]);
    expect(cart.subtotal).toBe(6800 + 1950);
  });

  it("acknowledgePrice accepts the new price so checkout can continue", async () => {
    const { service, insert } = setup();
    const row = insert(alice, "v-book", { priceAtAdd: "600.00" });
    let cart = await service.getCart(alice, "inside_dhaka");
    expect(cart.groups[0].lines[0].priceChanged).toBe(true);
    expect(cartReadyForCheckout(cart).ready).toBe(false);

    expect((await service.updateItem(alice, row.id, { acknowledgePrice: true })).message).toBe("New price accepted.");
    expect(row.priceAtAdd).toBe("650.00");
    cart = await service.getCart(alice, "inside_dhaka");
    expect(cartReadyForCheckout(cart)).toEqual({ ready: true, reasons: [] });
  });

  it("another user's or guest's row is not found and not changed", async () => {
    const { service, insert } = setup();
    const row = insert(bob, "v-novel", { quantity: 1 });
    const guestRow = insert(guest, "v-novel", { quantity: 1 });
    await rejects(service.updateItem(alice, row.id, { quantity: 2 }), 404, "NOT_FOUND");
    await rejects(service.updateItem(guest, row.id, { quantity: 2 }), 404, "NOT_FOUND");
    await rejects(service.updateItem(otherGuest, guestRow.id, { savedForLater: true }), 404, "NOT_FOUND");
    await rejects(service.updateItem(alice, guestRow.id, { acknowledgePrice: true }), 404, "NOT_FOUND");
    expect(row.quantity).toBe(1);
    expect(guestRow.savedForLater).toBe(false);
  });
});

describe("removeItem and clearItems", () => {
  it("removes only the owner's rows", async () => {
    const { service, insert, rows } = setup();
    const mine = insert(alice, "v-ram");
    const theirs = insert(bob, "v-ram");
    await rejects(service.removeItem(alice, theirs.id), 404, "NOT_FOUND");
    await rejects(service.removeItem(guest, mine.id), 404, "NOT_FOUND");
    await service.removeItem(alice, mine.id);
    expect(rows.map((r) => r.id)).toEqual([theirs.id]);
  });

  it("clearItems (after checkout) ignores ids that aren't the owner's", async () => {
    const { service, insert, rows } = setup();
    const a1 = insert(alice, "v-ram");
    const a2 = insert(alice, "v-novel");
    const b1 = insert(bob, "v-ram");
    expect(await service.clearItems(alice, [a1.id, b1.id])).toBe(1);
    expect(rows.map((r) => r.id).sort()).toEqual([a2.id, b1.id].sort());
    expect(await service.clearItems(alice, [])).toBe(0);
  });
});

describe("mergeGuestCart (US-050: guest cart merges at login)", () => {
  it("moves new lines and adds quantities of shared ones, capped at the stock", async () => {
    const { service, insert, rows } = setup();
    insert(alice, "v-novel", { quantity: 1 });
    insert(alice, "v-book", { quantity: 2 });
    insert(guest, "v-novel", { quantity: 2 });
    insert(guest, "v-book", { quantity: 2 }); // 2 + 2 > 3 in stock
    insert(guest, "v-ram", { quantity: 1 });
    insert(otherGuest, "v-shirt-m"); // another device: untouched

    const result = await service.mergeGuestCart("g-token", "alice");
    expect(result).toEqual({ moved: 1, combined: 2, messages: ["Maths: Only 3 in stock. Quantity set to 3."] });

    const cart = await service.getCart(alice, "inside_dhaka");
    const qty = Object.fromEntries(cart.groups.flatMap((g) => g.lines.map((l) => [l.variantId, l.quantity])));
    expect(qty).toEqual({ "v-novel": 3, "v-book": 3, "v-ram": 1 });
    expect(rows.filter((r) => r.guestToken === "g-token")).toEqual([]);
    expect(rows.filter((r) => r.guestToken === "g-other")).toHaveLength(1);
    expect((await service.getCart(guest, "inside_dhaka")).groups).toEqual([]);
  });

  it("keeps the price the customer saw most recently, so a price notice still shows", async () => {
    const { service, insert } = setup();
    const old = insert(alice, "v-book", { priceAtAdd: "650.00", updatedAt: new Date("2026-10-01") });
    insert(guest, "v-book", { priceAtAdd: "600.00", updatedAt: new Date("2026-10-10") });
    await service.mergeGuestCart("g-token", "alice");
    expect(old.priceAtAdd).toBe("600.00");
    const cart = await service.getCart(alice, "inside_dhaka");
    expect(cart.groups[0].lines[0].priceChanged).toBe(true);
  });

  it("a line in the cart on either side stays in the cart; saved on both stays saved", async () => {
    const { service, insert } = setup();
    const a = insert(alice, "v-novel", { savedForLater: true });
    insert(guest, "v-novel", { savedForLater: false });
    const b = insert(alice, "v-ram", { savedForLater: true });
    insert(guest, "v-ram", { savedForLater: true });
    await service.mergeGuestCart("g-token", "alice");
    expect(a.savedForLater).toBe(false);
    expect(b.savedForLater).toBe(true);
  });

  it("is a no-op for an empty guest cart and safe to run twice", async () => {
    const { service, insert } = setup();
    insert(guest, "v-ram", { quantity: 2 });
    await service.mergeGuestCart("g-token", "alice");
    expect(await service.mergeGuestCart("g-token", "alice")).toEqual({ moved: 0, combined: 0, messages: [] });
    expect(await service.countItems(alice)).toBe(2);
  });
});

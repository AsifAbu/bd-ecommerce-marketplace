import { describe, expect, it } from "vitest";
import { buildCart, cartReadyForCheckout, isInsideDhaka, quantityLimit, resolveZone, unitWeight, MAX_LINE_QUANTITY } from "./model";
import { bookShop, cartRow, techShop, TODAY, type FakeVariant } from "./test-fixtures";

const ram: FakeVariant = { id: "v-ram", productId: "p-ram", shop: techShop, title: "RAM", price: "6800.00", stock: 25, weightG: 250 };
const cpu: FakeVariant = { id: "v-cpu", productId: "p-cpu", shop: techShop, title: "CPU", price: "24500.00", stock: 12, weightG: 400 };
const book: FakeVariant = { id: "v-book", productId: "p-book", shop: bookShop, title: "Engineering Maths", price: "650.00", stock: 8, weightG: 250 };
const novel: FakeVariant = { id: "v-novel", productId: "p-novel", shop: bookShop, title: "Himu", price: "250.00", stock: 40, weightG: 250 };

const inside = { zone: "inside_dhaka" as const, today: TODAY };
const outside = { zone: "outside_dhaka" as const, today: TODAY };

describe("US-050: items from several shops are grouped by shop", () => {
  it("one group per shop with its own lines, subtotal and delivery charge", () => {
    const cart = buildCart([cartRow(ram), cartRow(book, { quantity: 2 }), cartRow(novel)], inside);
    expect(cart.groups.map((g) => g.shop.name)).toEqual(["Tech Shop", "Book Shop"]);
    const [tech, books] = cart.groups;
    expect(tech.lines.map((l) => l.title)).toEqual(["RAM"]);
    expect(tech.subtotal).toBe(6800);
    expect(tech.deliveryCharge).toBe(70);
    expect(books.lines.map((l) => l.title)).toEqual(["Engineering Maths", "Himu"]);
    expect(books.subtotal).toBe(1550);
    expect(books.itemCount).toBe(3);
    expect(books.deliveryCharge).toBe(70); // 750 g
    expect(cart.subtotal).toBe(8350);
    expect(cart.deliveryTotal).toBe(140);
    expect(cart.grandTotal).toBe(8490);
    expect(cart.itemCount).toBe(4);
    expect(tech.shop.href).toBe("/s/tech");
  });

  it("an empty cart has no groups and zero totals", () => {
    const cart = buildCart([], inside);
    expect(cart).toMatchObject({ groups: [], itemCount: 0, subtotal: 0, deliveryTotal: 0, grandTotal: 0 });
  });

  it("keeps money exact in paisa", () => {
    const odd: FakeVariant = { ...novel, id: "v-odd", productId: "p-odd", price: "0.10" };
    const cart = buildCart([cartRow(odd, { quantity: 3 })], inside);
    expect(cart.groups[0].subtotal).toBe(0.3);
    expect(cart.grandTotal).toBe(70.3);
  });
});

describe("US-058: delivery charge per shop (D9) with weight and the free-delivery threshold", () => {
  it("charges by zone: Tk 70 inside Dhaka, Tk 130 outside", () => {
    expect(buildCart([cartRow(novel)], inside).groups[0].deliveryCharge).toBe(70);
    expect(buildCart([cartRow(novel)], outside).groups[0].deliveryCharge).toBe(130);
  });

  it("adds Tk 20 per started kg above 1 kg, from weight_g × quantity", () => {
    // 9 × 250 g = 2,250 g -> 2 extra kg
    const group = buildCart([cartRow(book, { quantity: 8 }), cartRow(novel)], inside).groups[0];
    expect(group.weightGrams).toBe(2250);
    expect(group.delivery).toMatchObject({ base: 70, extraKg: 2, extraCharge: 40, total: 110 });
    expect(group.deliveryCharge).toBe(110);
    expect(buildCart([cartRow(book, { quantity: 8 }), cartRow(novel)], outside).groups[0].deliveryCharge).toBe(170);
  });

  it("a product without weight_g counts as 0 g", () => {
    const light: FakeVariant = { ...novel, id: "v-light", productId: "p-light", weightG: undefined };
    expect(buildCart([cartRow(light, { quantity: 50 })], inside).groups[0].deliveryCharge).toBe(70);
    expect(unitWeight({ weight_g: "300" })).toBe(0);
    expect(unitWeight({ weight_g: 300 })).toBe(300);
  });

  it("below the shop's threshold: the charge applies and the hint says how much more", () => {
    const group = buildCart([cartRow(ram)], inside).groups[0];
    expect(group).toMatchObject({ freeDelivery: false, deliveryCharge: 70, freeDeliveryThreshold: 10000, amountForFreeDelivery: 3200, total: 6870 });
  });

  it("at or above the threshold: free delivery for that shop only", () => {
    const cart = buildCart([cartRow(ram, { quantity: 2 }), cartRow(novel)], outside);
    const [tech, books] = cart.groups;
    expect(tech).toMatchObject({ freeDelivery: true, deliveryCharge: 0, amountForFreeDelivery: null, total: 13600 });
    expect(tech.delivery.total).toBe(130); // what it would have cost
    expect(books).toMatchObject({ freeDelivery: false, deliveryCharge: 130, freeDeliveryThreshold: null, amountForFreeDelivery: null });
    expect(cart.deliveryTotal).toBe(130);

    const exact: FakeVariant = { ...ram, id: "v-exact", productId: "p-exact", price: "10000.00" };
    expect(buildCart([cartRow(exact)], inside).groups[0].freeDelivery).toBe(true);
  });

  it("a shop with only unavailable or saved lines has no group and no delivery charge", () => {
    const off: FakeVariant = { ...cpu, live: false };
    const cart = buildCart([cartRow(off), cartRow(ram, { savedForLater: true }), cartRow(novel)], inside);
    expect(cart.groups.map((g) => g.shop.id)).toEqual(["shop-book"]);
    expect(cart.deliveryTotal).toBe(70);
  });
});

describe("US-056: stock and price re-checked on every read", () => {
  it("a stored quantity above the stock is capped with a notice and reported for saving", () => {
    const low: FakeVariant = { ...book, stock: 3 };
    const cart = buildCart([cartRow(low, { id: "ci-low", quantity: 5 })], inside);
    const line = cart.groups[0].lines[0];
    expect(line).toMatchObject({ quantity: 3, quantityCapped: true, lineTotal: 1950 });
    expect(line.notices).toContain("Only 3 left in stock. We changed the quantity to 3.");
    expect(cart.adjustments).toEqual([{ id: "ci-low", quantity: 3 }]);
    expect(cart.groups[0].subtotal).toBe(1950);
  });

  it("never more than the per-item limit", () => {
    expect(quantityLimit(500)).toBe(MAX_LINE_QUANTITY);
    expect(quantityLimit(3)).toBe(3);
    expect(quantityLimit(0)).toBe(1);
  });

  it("a changed price shows the new price and a notice, and blocks checkout until accepted", () => {
    const cart = buildCart([cartRow(book, { priceAtAdd: "600.00", quantity: 2 }), cartRow(novel)], inside);
    const line = cart.groups[0].lines[0];
    expect(line).toMatchObject({ unitPrice: 650, priceAtAdd: 600, priceChanged: true, lineTotal: 1300 });
    expect(line.notices).toContain("The price went up from Tk 600 to Tk 650 since you added it.");
    expect(cart.priceChangedCount).toBe(1);
    expect(cartReadyForCheckout(cart)).toEqual({
      ready: false,
      reasons: ["The price of 1 item changed. Accept the new price to continue."],
    });

    // Accepting copies the current price into priceAtAdd.
    const accepted = buildCart([cartRow(book, { priceAtAdd: "650.00", quantity: 2 }), cartRow(novel)], inside);
    expect(accepted.groups[0].lines[0].priceChanged).toBe(false);
    expect(cartReadyForCheckout(accepted)).toEqual({ ready: true, reasons: [] });
  });

  it("a price drop is flagged too", () => {
    const line = buildCart([cartRow(book, { priceAtAdd: "700" })], inside).groups[0].lines[0];
    expect(line.notices).toContain("The price went down from Tk 700 to Tk 650 since you added it.");
  });

  it("out-of-stock and no-longer-live lines are listed apart and left out of the totals", () => {
    const sold: FakeVariant = { ...book, stock: 0 };
    const gone: FakeVariant = { ...cpu, live: false };
    const suspended: FakeVariant = { ...novel, shop: { ...bookShop, status: "suspended" } };
    const cart = buildCart([cartRow(sold), cartRow(gone), cartRow(suspended), cartRow(ram)], inside);
    expect(cart.unavailable.map((l) => [l.title, l.status])).toEqual([
      ["Engineering Maths", "out_of_stock"],
      ["CPU", "unavailable"],
      ["Himu", "unavailable"],
    ]);
    expect(cart.unavailable[0].notices).toContain("Out of stock. It won't be ordered.");
    expect(cart.unavailable[1].notices).toContain("No longer available. It won't be ordered.");
    expect(cart.subtotal).toBe(6800);
    expect(cart.itemCount).toBe(1);
    expect(cartReadyForCheckout(cart).ready).toBe(true); // they don't block: they aren't ordered
  });

  it("a cart with nothing orderable is not ready", () => {
    const cart = buildCart([cartRow({ ...book, stock: 0 })], inside);
    expect(cartReadyForCheckout(cart)).toEqual({ ready: false, reasons: ["Your cart has no items that can be ordered."] });
  });
});

describe("US-056: save for later", () => {
  it("moves the line out of the totals into the saved list", () => {
    const rows = [cartRow(ram), cartRow(book, { quantity: 2 })];
    const before = buildCart(rows, inside);
    expect(before.subtotal).toBe(8100);

    const after = buildCart([rows[0], { ...rows[1], savedForLater: true }], inside);
    expect(after.groups.map((g) => g.shop.id)).toEqual(["shop-tech"]);
    expect(after.saved.map((l) => l.title)).toEqual(["Engineering Maths"]);
    expect(after.subtotal).toBe(6800);
    expect(after.deliveryTotal).toBe(70);
    expect(after.itemCount).toBe(1);
  });

  it("a saved line with a changed price doesn't block checkout and isn't capped", () => {
    const cart = buildCart([cartRow(ram), cartRow({ ...book, stock: 1 }, { savedForLater: true, priceAtAdd: "1", quantity: 4 })], inside);
    expect(cart.saved[0]).toMatchObject({ quantity: 4, quantityCapped: false, priceChanged: true, notices: [] });
    expect(cart.adjustments).toEqual([]);
    expect(cartReadyForCheckout(cart).ready).toBe(true);
  });
});

describe("delivery zone", () => {
  it("isInsideDhaka: Dhaka district only", () => {
    expect(isInsideDhaka({ division: "Dhaka", district: "Dhaka" })).toBe(true);
    expect(isInsideDhaka({ division: "Dhaka", district: " dhaka " })).toBe(true);
    expect(isInsideDhaka({ division: "Dhaka", district: "Gazipur" })).toBe(false);
    expect(isInsideDhaka({ division: "Chattogram", district: "Chattogram" })).toBe(false);
    expect(isInsideDhaka(null)).toBe(false);
  });

  it("resolveZone: the cart page choice, else the default address, else inside Dhaka", () => {
    const outsideAddress = { division: "Chattogram", district: "Chattogram" };
    expect(resolveZone({ chosen: "inside_dhaka", defaultAddress: outsideAddress })).toEqual({ zone: "inside_dhaka", source: "chosen" });
    expect(resolveZone({ chosen: "bogus", defaultAddress: outsideAddress })).toEqual({ zone: "outside_dhaka", source: "address" });
    expect(resolveZone({ defaultAddress: { division: "Dhaka", district: "Dhaka" } })).toEqual({ zone: "inside_dhaka", source: "address" });
    expect(resolveZone({})).toEqual({ zone: "inside_dhaka", source: "default" });
  });
});

describe("line details", () => {
  it("links to the product with the variant and shows the raw options without a schema", () => {
    const shirt: FakeVariant = { ...novel, id: "v-shirt", productId: "p-shirt", options: { size: "m" } };
    const line = buildCart([cartRow(shirt)], inside).groups[0].lines[0];
    expect(line.href).toBe("/products/p-shirt?variant=v-shirt");
    expect(line.variantLabel).toBe("size: m");
    expect(buildCart([cartRow(novel)], inside).groups[0].lines[0].variantLabel).toBeNull();
  });
});

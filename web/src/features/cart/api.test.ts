import { describe, expect, it } from "vitest";
import { createWishlistService, type WishlistService } from "@/features/wishlist";
import { UnauthorizedError } from "@/lib/auth/errors";
import { createCartApi } from "./api";
import type { DeliveryZone } from "@/lib/delivery";
import { resolveZone } from "./model";
import { createCartService, type CartOwner } from "./service";
import { bookShop, createMemoryRepo, techShop, TODAY, type FakeVariant } from "./test-fixtures";

// The JSON API: standard error shape, and the owner always comes from the session or the guest
// cookie (never the request), so one customer or device can't read or change another's cart.

const ram: FakeVariant = { id: "v-ram", productId: "p-ram", shop: techShop, title: "RAM", price: "6800.00", stock: 25, weightG: 250 };
const book: FakeVariant = { id: "v-book", productId: "p-book", shop: bookShop, title: "Maths", price: "650.00", stock: 3, weightG: 250 };
const novel: FakeVariant = { id: "v-novel", productId: "p-novel", shop: bookShop, title: "Himu", price: "250.00", stock: 40, weightG: 250 };

interface Session {
  user: string | null;
  guest: string | null;
}

function setup(session: Session = { user: null, guest: null }) {
  const mem = createMemoryRepo([ram, book, novel]);
  const service = createCartService({ repo: mem.repo, getCategorySchema: async () => Promise.reject(new Error("none")), now: () => TODAY });
  const created: string[] = [];
  const wishlist = createFakeWishlist();
  const api = createCartApi({
    resolveOwner: async ({ create }) => {
      if (session.user) return { kind: "user", userId: session.user };
      if (session.guest) return { kind: "guest", guestToken: session.guest };
      if (!create) return null;
      session.guest = `new-guest-${created.length + 1}`;
      created.push(session.guest);
      return { kind: "guest", guestToken: session.guest };
    },
    requireUser: async () => {
      if (!session.user) throw new UnauthorizedError();
      return { id: session.user };
    },
    resolveZone: async (_owner: CartOwner | null, override?: unknown) => resolveZone({ chosen: override }) as { zone: DeliveryZone; source: "chosen" | "default" },
    mergeGuestCart: async (userId) => (session.guest ? service.mergeGuestCart(session.guest, userId) : null),
    moveToCart: wishlist.service.moveToCart,
    service,
  });
  return { ...mem, service, api, session, created, wishlist };
}

const json = (body: unknown, contentType = "application/json") =>
  new Request("http://localhost/api/cart/items", { method: "POST", headers: { "content-type": contentType }, body: JSON.stringify(body) });
const patch = (body: unknown) =>
  new Request("http://localhost/api/cart/items/x", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const get = (query = "") => new Request(`http://localhost/api/cart${query}`);

describe("cart API", () => {
  it("a guest's first add creates a device cart (201), the next add returns 200", async () => {
    const { api, created } = setup();
    const res = await api.add(json({ variantId: "v-ram" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ item: { quantity: 1 }, message: "Added to your cart.", count: 1 });
    expect(created).toHaveLength(1);
    const again = await api.add(json({ variantId: "v-ram", quantity: 2 }));
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ item: { quantity: 3 }, count: 3 });
  });

  it("GET returns the grouped cart, the readiness and the zone; ?zone= changes the charges", async () => {
    const { api } = setup({ user: "alice", guest: null });
    await api.add(json({ variantId: "v-ram" }));
    await api.add(json({ variantId: "v-novel" }));
    const body = await (await api.get(get())).json();
    expect(body.zone).toEqual({ zone: "inside_dhaka", source: "default" });
    expect(body.cart.groups.map((g: { shop: { name: string }; deliveryCharge: number }) => [g.shop.name, g.deliveryCharge])).toEqual([
      ["Tech Shop", 70],
      ["Book Shop", 70],
    ]);
    expect(body.readiness).toEqual({ ready: true, reasons: [] });
    const outside = await (await api.get(get("?zone=outside_dhaka"))).json();
    expect(outside.cart.deliveryTotal).toBe(260);
  });

  it("GET for a guest without a cart is an empty cart, not an error", async () => {
    const { api } = setup();
    const body = await (await api.get(get())).json();
    expect(body.cart.groups).toEqual([]);
    expect(body.readiness.ready).toBe(false);
  });

  it("caps the quantity at the stock with a message", async () => {
    const { api } = setup({ user: "alice", guest: null });
    const res = await api.add(json({ variantId: "v-book", quantity: 5 }));
    expect(await res.json()).toMatchObject({ capped: true, item: { quantity: 3 }, message: expect.stringContaining("Only 3 in stock") });
  });

  it("errors use the standard shape", async () => {
    const { api } = setup({ user: "alice", guest: null });
    const res = await api.add(json({}));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: { code: "VARIANT_REQUIRED", message: "Choose a variant (for example size or colour) first", fields: { variantId: "Choose a variant" } },
    });
    const bad = await api.add(new Request("http://localhost/api/cart/items", { method: "POST", headers: { "content-type": "application/json" }, body: "{" }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("INVALID_JSON");
  });

  it("refuses non-JSON bodies (a cross-site form can't post to the cart)", async () => {
    const { api } = setup({ user: "alice", guest: null });
    const res = await api.add(json({ variantId: "v-ram" }, "application/x-www-form-urlencoded"));
    expect(res.status).toBe(415);
    expect((await res.json()).error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("PATCH and DELETE on another user's or device's line are 404 and change nothing", async () => {
    const { api, insert, rows, session } = setup({ user: "alice", guest: null });
    const bobs = insert({ kind: "user", userId: "bob" }, "v-novel", { quantity: 1 });
    const guests = insert({ kind: "guest", guestToken: "g-1" }, "v-novel", { quantity: 1 });

    for (const id of [bobs.id, guests.id]) {
      const res = await api.update(patch({ quantity: 2 }), id);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: { code: "NOT_FOUND", message: "Cart item not found" } });
      expect((await api.remove(id)).status).toBe(404);
    }

    session.user = null;
    session.guest = "g-2"; // another device
    expect((await api.update(patch({ savedForLater: true }), guests.id)).status).toBe(404);
    expect((await api.remove(guests.id)).status).toBe(404);
    session.guest = null; // a device without a cart
    expect((await api.remove(guests.id)).status).toBe(404);

    expect(rows.map((r) => [r.id, r.quantity, r.savedForLater])).toEqual([
      [bobs.id, 1, false],
      [guests.id, 1, false],
    ]);
  });

  it("PATCH and DELETE on the owner's line work and return the new count", async () => {
    const { api, insert } = setup({ user: null, guest: "g-1" });
    const line = insert({ kind: "guest", guestToken: "g-1" }, "v-book", { quantity: 1, priceAtAdd: "600.00" });
    const res = await api.update(patch({ quantity: 9 }), line.id);
    expect(await res.json()).toMatchObject({ capped: true, item: { quantity: 3 }, count: 3 });
    const ack = await api.update(patch({ acknowledgePrice: true }), line.id);
    expect(await ack.json()).toMatchObject({ message: "New price accepted." });
    const saved = await api.update(patch({ savedForLater: true }), line.id);
    expect(await saved.json()).toMatchObject({ item: { savedForLater: true }, count: 0 });
    expect(await (await api.remove(line.id)).json()).toEqual({ ok: true, count: 0 });
  });

  it("POST /cart/merge needs a login and merges the device's guest cart", async () => {
    const { api, insert, session } = setup({ user: null, guest: "g-1" });
    insert({ kind: "guest", guestToken: "g-1" }, "v-novel", { quantity: 2 });
    expect((await api.merge()).status).toBe(401);
    session.user = "alice";
    expect(await (await api.merge()).json()).toEqual({ moved: 1, combined: 0, messages: [], count: 2 });
  });

  it("POST /cart/merge without a guest cart is a no-op", async () => {
    const { api } = setup({ user: "alice", guest: null });
    expect(await (await api.merge()).json()).toEqual({ moved: 0, combined: 0, messages: [], count: 0 });
  });
});

describe("POST /api/wishlist/[itemId]/move-to-cart (US-057)", () => {
  it("adds the chosen variant to the user's cart and removes it from the wishlist", async () => {
    const { api, wishlist, service } = setup({ user: "alice", guest: null });
    const res = await api.moveToCart(new Request("http://localhost/x", { method: "POST" }), "w-novel");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ productId: "p-novel", variantId: "v-novel", message: "Moved to your cart.", count: 1 });
    expect(wishlist.items.map((i) => i.id)).toEqual(["w-book", "w-bob"]);
    const cart = await service.getCart({ kind: "user", userId: "alice" }, "inside_dhaka");
    expect(cart.groups[0].lines.map((l) => l.variantId)).toEqual(["v-novel"]);
  });

  it("needs a login; another user's wishlist item is a 404", async () => {
    const { api, session, wishlist } = setup();
    expect((await api.moveToCart(new Request("http://localhost/x", { method: "POST" }), "w-novel")).status).toBe(401);
    session.user = "alice";
    const res = await api.moveToCart(new Request("http://localhost/x", { method: "POST" }), "w-bob");
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
    expect(wishlist.items).toHaveLength(3);
  });

  it("an out-of-stock wishlist item can't be moved and stays in the wishlist", async () => {
    const { api, wishlist, rows } = setup({ user: "alice", guest: null });
    wishlist.stock.set("v-book", 0);
    const res = await api.moveToCart(new Request("http://localhost/x", { method: "POST" }), "w-book");
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("OUT_OF_STOCK");
    expect(wishlist.items.map((i) => i.id)).toContain("w-book");
    expect(rows).toEqual([]);
  });

  it("a cart refusal keeps the wishlist item", async () => {
    const { api, wishlist, catalogue } = setup({ user: "alice", guest: null });
    catalogue.set("v-novel", { ...novel, live: false }); // hidden between the two reads
    const res = await api.moveToCart(new Request("http://localhost/x", { method: "POST" }), "w-novel");
    expect(res.status).toBe(404);
    expect(wishlist.items.map((i) => i.id)).toContain("w-novel");
  });
});

/** A two-user wishlist over the same products, using the real wishlist service rules. */
function createFakeWishlist(): { service: WishlistService; items: { id: string; userId: string; productId: string; variantId: string }[]; stock: Map<string, number> } {
  const stock = new Map([
    ["v-novel", 40],
    ["v-book", 3],
  ]);
  const items = [
    { id: "w-novel", userId: "alice", productId: "p-novel", variantId: "v-novel" },
    { id: "w-book", userId: "alice", productId: "p-book", variantId: "v-book" },
    { id: "w-bob", userId: "bob", productId: "p-novel", variantId: "v-novel" },
  ];
  const product = (productId: string, variantId: string) => ({
    id: productId,
    title: productId,
    categoryId: "cat-1",
    status: "active" as const,
    deletedAt: null,
    expiresOn: null,
    shop: { name: "Book Shop", status: "approved" as const, medicineSuspended: false },
    category: { requiresLicence: false },
    variants: [{ id: variantId, price: "100.00", stock: stock.get(variantId) ?? 0, options: {} }],
    images: [],
  });
  const row = (i: (typeof items)[number]) => ({ ...i, createdAt: TODAY, product: product(i.productId, i.variantId) });
  const service = createWishlistService({
    repo: {
      listItems: async (userId) => items.filter((i) => i.userId === userId).map(row),
      getItem: async (userId, itemId) => {
        const i = items.find((x) => x.id === itemId && x.userId === userId);
        return i ? row(i) : null;
      },
      countItems: async (userId) => items.filter((i) => i.userId === userId).length,
      findForProduct: async () => [],
      findSame: async () => null,
      createItem: async () => {
        throw new Error("not used");
      },
      deleteItem: async (userId, itemId) => {
        const i = items.findIndex((x) => x.id === itemId && x.userId === userId);
        if (i < 0) return false;
        items.splice(i, 1);
        return true;
      },
      findLiveProduct: async () => null,
    },
    getCategorySchema: async () => Promise.reject(new Error("none")),
    now: () => TODAY,
  });
  return { service, items, stock };
}

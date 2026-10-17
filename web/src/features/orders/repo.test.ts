import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "@/lib/testing/fake-db";
import type { OrderDraft } from "./draft";

// Orders data access: customers only ever read their own orders, shops only their own shop
// orders (ADR-004), and the placement transaction is all-or-nothing.
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  get prisma() {
    return state.db;
  },
}));

const repo = await import("./repo");
const { StockConflictError } = await import("./placement");

type Tables = "order" | "shopOrder" | "orderItem" | "productVariant" | "cartItem" | "shop" | "user";
let db: ReturnType<typeof createFakeDb<Tables>>;

beforeEach(() => {
  db = createFakeDb<Tables>({
    user: [
      { id: "A", phone: "+8801711111111", phoneVerifiedAt: new Date(), status: "active" },
      { id: "B", phone: "+8801722222222", phoneVerifiedAt: null, status: "active" },
    ],
    shop: [
      { id: "s1", name: "Shop 1", tier: "basic", registrationType: null, registrationNo: null },
      { id: "s2", name: "Shop 2", tier: "verified", registrationType: "trade_licence", registrationNo: "TL-2" },
    ],
    order: [
      { id: "oA", orderNo: "BD-261017-AAAAA", userId: "A", contactPhone: "+8801711111111", placedAt: new Date(1) },
      { id: "oB", orderNo: "BD-261017-BBBBB", userId: "B", contactPhone: "+8801722222222", placedAt: new Date(2) },
      { id: "oG", orderNo: "BD-261017-GGGGG", userId: null, contactPhone: "+8801711111111", placedAt: new Date(3) },
    ],
    shopOrder: [
      { id: "soA1", orderId: "oA", shopId: "s1", status: "placed" },
      { id: "soA2", orderId: "oA", shopId: "s2", status: "delivered" },
      { id: "soB1", orderId: "oB", shopId: "s2", status: "refused" },
      { id: "soG1", orderId: "oG", shopId: "s1", status: "confirmed" },
    ],
    orderItem: [],
    productVariant: [
      { id: "v1", productId: "p1", shopId: "s1", price: "100.00", stock: 5 },
      { id: "v2", productId: "p2", shopId: "s2", price: "200.00", stock: 1 },
    ],
    cartItem: [
      { id: "cA1", userId: "A", guestToken: null, variantId: "v1" },
      { id: "cA2", userId: "A", guestToken: null, variantId: "v2" },
      { id: "cB1", userId: "B", guestToken: null, variantId: "v1" },
    ],
  });
  state.db = db;
});

const ids = (rows: { id?: unknown }[]) => rows.map((r) => String(r.id)).sort();

describe("customer reads are scoped by userId", () => {
  it("lists only the user's own orders (never another user's or a guest's)", async () => {
    expect(ids(await repo.listOrdersForUser("A"))).toEqual(["oA"]);
    expect(ids(await repo.listOrdersForUser("B"))).toEqual(["oB"]);
  });

  it("gets an order only for its owner", async () => {
    expect((await repo.getOrderForUser("A", "BD-261017-AAAAA"))?.id).toBe("oA");
    expect(await repo.getOrderForUser("A", "BD-261017-BBBBB")).toBeNull();
    expect(await repo.getOrderForUser("A", "BD-261017-GGGGG")).toBeNull(); // guest order with A's mobile, not yet linked
  });
});

describe("shop reads are scoped by shopId (ADR-004)", () => {
  it("lists only the shop's own shop orders", async () => {
    expect(ids(await repo.listShopOrders("s1"))).toEqual(["soA1", "soG1"]);
    expect(ids(await repo.listShopOrders("s2"))).toEqual(["soA2", "soB1"]);
    expect(ids(await repo.listShopOrders("s2", { status: "refused" }))).toEqual(["soB1"]);
  });

  it("returns another shop's shop order as null", async () => {
    expect((await repo.getShopOrderForShop("s1", "soA1"))?.id).toBe("soA1");
    expect(await repo.getShopOrderForShop("s1", "soA2")).toBeNull();
  });
});

describe("COD history (D8) and shop limits (D14)", () => {
  it("counts the mobile's guest and account orders: open orders, delivered and refused shop orders", async () => {
    // A's mobile: oA (open + delivered) and the guest order oG (open).
    expect(await repo.codHistory("+8801711111111", "A")).toEqual({ openOrders: 2, delivered: 1, refused: 0 });
    expect(await repo.codHistory("+8801711111111", null)).toEqual({ openOrders: 2, delivered: 1, refused: 0 });
    expect(await repo.codHistory("+8801722222222", "B")).toEqual({ openOrders: 0, delivered: 0, refused: 1 });
    expect(await repo.codHistory("+8801799999999", null)).toEqual({ openOrders: 0, delivered: 0, refused: 0 });
  });

  it("gives each shop its open shop orders and its tier limit", async () => {
    const facts = await repo.shopFacts(["s1", "s2"]);
    expect(facts.get("s1")).toMatchObject({ openOrders: 2, maxOpenOrders: 20, registration: null });
    expect(facts.get("s2")).toMatchObject({ openOrders: 0, maxOpenOrders: null, registration: "Trade licence TL-2" });
  });

  it("finds an account only by a VERIFIED phone", async () => {
    expect(await repo.findAccountByVerifiedPhone("+8801711111111")).toMatchObject({ id: "A" });
    expect(await repo.findAccountByVerifiedPhone("+8801722222222")).toBeNull();
  });
});

describe("linking guest orders", () => {
  it("attaches only orders that have no account yet", async () => {
    expect(await repo.attachGuestOrders("A", { contactPhone: "+8801711111111" }, "phone", new Date(5))).toBe(1);
    expect(db.order.rows.find((o) => o.id === "oG")).toMatchObject({ userId: "A", linkedVia: "phone" });
    expect(await repo.attachGuestOrders("B", { contactPhone: "+8801711111111" }, "phone", new Date(5))).toBe(0);
    expect(db.order.rows.find((o) => o.id === "oA")?.userId).toBe("A");
  });
});

function draft(items: { variantId: string; quantity: number; unitPrice: string }[]): OrderDraft {
  return {
    orderNo: "BD-261017-NNNNN",
    userId: "A",
    linkedVia: null,
    contactName: "A",
    contactPhone: "+8801711111111",
    phoneVerifiedAt: new Date(),
    contactEmail: null,
    address: { name: "A", phone: "+8801711111111", division: "Dhaka", district: "Dhaka", upazila: "Dhanmondi", area: "x", line1: "y" },
    zone: "inside_dhaka",
    itemsSubtotal: "0",
    deliveryTotal: "0",
    grandTotal: "0",
    policyVersions: [],
    idempotencyKey: "key",
    placedAt: new Date(),
    shopOrders: [
      {
        shopId: "s1",
        seq: 1,
        shopName: "Shop 1",
        shopRegistration: null,
        itemsSubtotal: "0",
        weightGrams: 0,
        deliveryCharge: "70.00",
        freeDelivery: false,
        total: "0",
        vatRate: "0.00",
        vatAmount: "0.00",
        commissionAmount: "0.00",
        launchOffer: false,
        handoverDueAt: new Date(),
        items: items.map((i) => ({
          cartItemId: "",
          productId: "p",
          categoryId: "c",
          title: `Item ${i.variantId}`,
          variantLabel: null,
          sku: null,
          lineTotal: "0",
          unitWeightGrams: 0,
          warranty: null,
          commissionRate: "0.00",
          ...i,
        })),
      },
    ],
  };
}

describe("place (the order transaction)", () => {
  it("lowers stock, writes the order and removes only the owner's ordered cart lines", async () => {
    const placed = await repo.place(
      draft([
        { variantId: "v1", quantity: 2, unitPrice: "100.00" },
        { variantId: "v2", quantity: 1, unitPrice: "200.00" },
      ]),
      { kind: "user", userId: "A" },
      ["cA1", "cA2", "cB1"],
    );
    expect(placed.orderNo).toBe("BD-261017-NNNNN");
    expect(db.productVariant.rows.map((v) => v.stock)).toEqual([3, 0]);
    expect(db.order.rows.some((o) => o.orderNo === "BD-261017-NNNNN")).toBe(true);
    expect(ids(db.cartItem.rows)).toEqual(["cB1"]); // B's line is not A's to clear
  });

  it("writes nothing when one variant lacks stock (stock race), naming the item", async () => {
    const before = db.order.rows.length;
    await expect(
      repo.place(
        draft([
          { variantId: "v1", quantity: 2, unitPrice: "100.00" },
          { variantId: "v2", quantity: 2, unitPrice: "200.00" },
        ]),
        { kind: "user", userId: "A" },
        ["cA1", "cA2"],
      ),
    ).rejects.toMatchObject({ name: "StockConflictError", variantId: "v2", available: 1, reason: "stock", title: "Item v2" });
    expect(db.productVariant.rows.map((v) => v.stock)).toEqual([5, 1]);
    expect(db.order.rows).toHaveLength(before);
    expect(ids(db.cartItem.rows)).toEqual(["cA1", "cA2", "cB1"]);
  });

  it("fails as a price change when the price moved since the cart was read", async () => {
    const err = await repo.place(draft([{ variantId: "v1", quantity: 1, unitPrice: "90.00" }]), { kind: "user", userId: "A" }, []).catch((e) => e);
    expect(err).toBeInstanceOf(StockConflictError);
    expect(err.reason).toBe("price");
  });
});

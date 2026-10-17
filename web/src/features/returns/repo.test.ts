import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "@/lib/testing/fake-db";

// Returns data access is scoped (ADR-004): customers see requests on their own orders (also
// linked guest orders), a shop only its own, the admin queue only escalated ones. Status changes
// are conditional, restock once, and mark the shop order returned when everything is refunded.
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  get prisma() {
    return state.db;
  },
}));

const repo = await import("./repo");

type Tables = "returnRequest" | "order" | "shopOrder" | "orderItem" | "productVariant";
let db: ReturnType<typeof createFakeDb<Tables>>;

beforeEach(() => {
  db = createFakeDb<Tables>({
    order: [
      { id: "oA", orderNo: "BD-261010-AAAAA", userId: "A" },
      { id: "oB", orderNo: "BD-261010-BBBBB", userId: "B" },
      // A guest order later linked to A (US-009): requests made as a guest show up for A.
      { id: "oG", orderNo: "BD-261010-GGGGG", userId: "A" },
    ],
    shopOrder: [
      { id: "soA", orderId: "oA", shopId: "s1", status: "delivered" },
      { id: "soB", orderId: "oB", shopId: "s2", status: "delivered" },
      { id: "soG", orderId: "oG", shopId: "s1", status: "delivered" },
    ],
    orderItem: [
      { id: "iA", shopOrderId: "soA", quantity: 1, variantId: "v1" },
      { id: "iB", shopOrderId: "soB", quantity: 2, variantId: "v2" },
      { id: "iG", shopOrderId: "soG", quantity: 1, variantId: "v1" },
    ],
    productVariant: [
      { id: "v1", stock: 5 },
      { id: "v2", stock: 1 },
    ],
    returnRequest: [
      { id: "rA", orderId: "oA", shopOrderId: "soA", orderItemId: "iA", shopId: "s1", userId: "A", status: "accepted", quantity: 1, createdAt: new Date(1) },
      { id: "rB", orderId: "oB", shopOrderId: "soB", orderItemId: "iB", shopId: "s2", userId: "B", status: "escalated", quantity: 1, createdAt: new Date(2) },
      { id: "rG", orderId: "oG", shopOrderId: "soG", orderItemId: "iG", shopId: "s1", userId: null, status: "requested", quantity: 1, createdAt: new Date(3), shopDueAt: new Date(10) },
    ],
  });
  state.db = db;
});

const ids = (rows: { id?: unknown }[]) => rows.map((r) => String(r.id)).sort();

describe("scoped reads", () => {
  it("customer lists: own requests and requests on own (linked) orders, never another user's", async () => {
    expect(ids(await repo.listForUser("A"))).toEqual(["rA", "rG"]);
    expect(ids(await repo.listForUser("B"))).toEqual(["rB"]);
    expect(ids(await repo.listForOrder("oA"))).toEqual(["rA"]);
  });

  it("shop lists only its own shop's requests", async () => {
    expect(ids(await repo.listForShop("s1"))).toEqual(["rA", "rG"]);
    expect(ids(await repo.listForShop("s2"))).toEqual(["rB"]);
    expect(ids(await repo.listForShop("s1", { status: "requested" }))).toEqual(["rG"]);
  });

  it("admin queue holds escalated requests by default", async () => {
    expect(ids(await repo.listForAdmin())).toEqual(["rB"]);
    expect(ids(await repo.listForAdmin({ status: "accepted" }))).toEqual(["rA"]);
  });

  it("one request by scope: another shop's or another order's is not found", async () => {
    expect(await repo.getRow({ kind: "shop", shopId: "s2" }, "rA")).toBeNull();
    expect(await repo.getRow({ kind: "order", orderId: "oB" }, "rA")).toBeNull();
    expect((await repo.getRow({ kind: "shop", shopId: "s1" }, "rA"))?.id).toBe("rA");
    expect((await repo.getRow({ kind: "admin" }, "rB"))?.id).toBe("rB");
  });

  it("overdue list holds only unanswered requests past their due time", async () => {
    expect(ids(await repo.listOverdue(new Date(11), 10))).toEqual(["rG"]);
    expect(await repo.listOverdue(new Date(9), 10)).toEqual([]);
  });
});

describe("update", () => {
  it("changes status only from the expected one", async () => {
    expect(await repo.update("rA", ["requested"], { status: "refunded" })).toBe(false);
    expect(db.returnRequest.rows.find((r) => r.id === "rA")?.status).toBe("accepted");
    expect(await repo.update("rA", ["accepted"], { status: "received" })).toBe(true);
  });

  it("restocks the variant in the same transaction", async () => {
    await repo.update("rA", ["accepted"], { status: "received" }, { restock: { variantId: "v1", quantity: 1 } });
    expect(db.productVariant.rows.find((v) => v.id === "v1")?.stock).toBe(6);
  });

  it("marks the shop order returned when every unit is refunded, not before", async () => {
    await repo.update("rB", ["escalated"], { status: "refunded", refundedAt: new Date(5) }, { completeShopOrder: true });
    expect(db.shopOrder.rows.find((s) => s.id === "soB")?.status).toBe("delivered"); // 1 of 2 units
    await repo.update("rA", ["accepted"], { status: "refunded", refundedAt: new Date(6) }, { completeShopOrder: true });
    expect(db.shopOrder.rows.find((s) => s.id === "soA")).toMatchObject({ status: "returned", statusChangedAt: new Date(6) });
  });

  it("knows when a shop order's delivery charge was already refunded", async () => {
    db.returnRequest.rows.push({ id: "rX", shopOrderId: "soB", status: "refunded", refundDelivery: 70 });
    expect(await repo.deliveryAlreadyRefunded("soB", "rB")).toBe(true);
    expect(await repo.deliveryAlreadyRefunded("soB", "rX")).toBe(false);
    expect(await repo.deliveryAlreadyRefunded("soA", "rA")).toBe(false);
  });
});

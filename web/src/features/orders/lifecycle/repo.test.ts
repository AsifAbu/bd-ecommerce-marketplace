import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "@/lib/testing/fake-db";
import { planTransition } from "./machine";

// Lifecycle data access: shop reads only return the shop's own shop orders (ADR-004), a customer
// only reaches the shop orders of the order they may see, and a status change is one
// all-or-nothing transaction (conditional update, restock, event, audit, hooks).
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  get prisma() {
    return state.db;
  },
}));

const repo = await import("./repo");

type Tables = "order" | "shopOrder" | "orderItem" | "productVariant" | "shopOrderEvent";
let db: ReturnType<typeof createFakeDb<Tables>>;
const NOW = new Date("2026-10-17T06:00:00Z");
const h = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000);
const TEST = { shopMarksDelivery: true };

beforeEach(() => {
  db = createFakeDb<Tables>({
    order: [
      { id: "o1", orderNo: "BD-261017-AAAAA" },
      { id: "o2", orderNo: "BD-261017-BBBBB" },
    ],
    shopOrder: [
      { id: "soA", orderId: "o1", shopId: "shopA", seq: 1, status: "placed", handoverDueAt: h(-1), overdueNotifiedAt: null, createdAt: h(-49) },
      { id: "soB", orderId: "o1", shopId: "shopB", seq: 2, status: "confirmed", handoverDueAt: h(10), overdueNotifiedAt: null, createdAt: h(-38) },
      { id: "soC", orderId: "o2", shopId: "shopA", seq: 1, status: "handed_over", handoverDueAt: h(-30), overdueNotifiedAt: null, createdAt: h(-78) },
    ],
    orderItem: [
      { id: "i1", shopOrderId: "soA", productId: "p1", variantId: "v1", quantity: 2 },
      { id: "i2", shopOrderId: "soA", productId: "p2", variantId: null, quantity: 1 }, // variant removed by the seller
      { id: "i3", shopOrderId: "soB", productId: "p3", variantId: "v3", quantity: 4 },
    ],
    productVariant: [
      { id: "v1", productId: "p1", stock: 5 },
      { id: "v3", productId: "p3", stock: 0 },
    ],
    shopOrderEvent: [],
  });
  state.db = db;
});

const target = async (id: string) => (await repo.findById(id))!;
const ids = (rows: { id?: unknown }[]) => rows.map((r) => String(r.id)).sort();

describe("scoping", () => {
  it("finds a shop order for its own shop only", async () => {
    expect((await repo.findForShop("shopA", "soA"))?.id).toBe("soA");
    expect(await repo.findForShop("shopA", "soB")).toBeNull();
    expect(await repo.findForShop("shopB", "soC")).toBeNull();
  });

  it("finds a shop order only within the customer's order", async () => {
    expect((await repo.findForOrder("o1", "soB"))?.id).toBe("soB");
    expect(await repo.findForOrder("o2", "soA")).toBeNull();
  });

  it("lists and details only the shop's own shop orders", async () => {
    expect(ids(await repo.listForShop("shopA", {}, NOW))).toEqual(["soA", "soC"]);
    expect(ids(await repo.listForShop("shopB", {}, NOW))).toEqual(["soB"]);
    expect(ids(await repo.listForShop("shopA", { overdue: true }, NOW))).toEqual(["soA"]);
    expect(ids(await repo.listForShop("shopB", { overdue: true }, NOW))).toEqual([]);
    expect(ids(await repo.listForShop("shopA", { status: "handed_over" }, NOW))).toEqual(["soC"]);
    expect(await repo.getDetailForShop("shopB", "soA")).toBeNull();
    expect((await repo.getDetailForShop("shopA", "soA"))?.id).toBe("soA");
    expect(await repo.countOverdue("shopA", NOW)).toBe(1);
    expect(await repo.countOverdue("shopB", NOW)).toBe(0);
  });

  it("gives the admin every shop's orders", async () => {
    expect(ids(await repo.listForAdmin({}, NOW))).toEqual(["soA", "soB", "soC"]);
    expect(ids(await repo.listForAdmin({ shopId: "shopB" }, NOW))).toEqual(["soB"]);
    expect(await repo.countOverdue(null, NOW)).toBe(1);
  });
});

describe("apply (one transaction)", () => {
  it("changes the status, writes the event and the audit entry, and returns the event", async () => {
    const plan = planTransition({ status: "placed", action: "confirm", actor: "shop_staff", now: NOW, config: TEST });
    const event = await repo.apply(await target("soA"), plan, { id: "u1", role: "shop_staff" }, []);
    expect(db.shopOrder.rows.find((r) => r.id === "soA")).toMatchObject({ status: "confirmed", confirmedAt: NOW, statusChangedAt: NOW });
    expect(db.shopOrderEvent.rows).toEqual([expect.objectContaining({ shopOrderId: "soA", action: "confirm", fromStatus: "placed", toStatus: "confirmed", actorId: "u1", actorRole: "shop_staff" })]);
    expect(db.auditLog.rows).toEqual([expect.objectContaining({ action: "shop_order.confirm", entity: "shop_order", entityId: "soA", actorId: "u1" })]);
    expect(event).toMatchObject({ shopOrderNo: expect.stringMatching(/-1$/), from: "placed", to: "confirmed", restocked: false });
  });

  it("restocks every variant on cancel (skipping removed variants) in the same transaction", async () => {
    const plan = planTransition({ status: "placed", action: "cancel", actor: "customer", now: NOW, config: TEST });
    const event = await repo.apply(await target("soA"), plan, { id: null, role: "customer" }, []);
    expect(db.productVariant.rows.find((v) => v.id === "v1")?.stock).toBe(7);
    expect(event.restockedProductIds).toEqual(["p1"]);
    expect(db.shopOrder.rows.find((r) => r.id === "soA")).toMatchObject({ status: "cancelled", cancelledBy: "customer", restockedAt: NOW });
    expect(db.shopOrderEvent.rows[0]).toMatchObject({ restocked: true });
  });

  it("does not restock a refused delivery", async () => {
    const plan = planTransition({ status: "handed_over", action: "refuse", actor: "shop_staff", now: NOW, config: TEST });
    await repo.apply(await target("soC"), plan, { id: "u1", role: "shop_staff" }, []);
    expect(db.shopOrder.rows.find((r) => r.id === "soC")?.status).toBe("refused");
    expect(db.productVariant.rows.find((v) => v.id === "v1")?.stock).toBe(5);
  });

  it("refuses (409) when the status changed since it was read, and writes nothing", async () => {
    const stale = await target("soA");
    db.shopOrder.rows.find((r) => r.id === "soA")!.status = "cancelled";
    const plan = planTransition({ status: "placed", action: "cancel", actor: "shop_staff", input: { reason: "No stock left" }, now: NOW, config: TEST });
    await expect(repo.apply(stale, plan, { id: "u1", role: "shop_staff" }, [])).rejects.toMatchObject({ status: 409, code: "STATUS_CHANGED" });
    expect(db.productVariant.rows.find((v) => v.id === "v1")?.stock).toBe(5); // not restocked twice
    expect(db.shopOrderEvent.rows).toEqual([]);
  });

  it("never changes another shop's order even with a forged target", async () => {
    const forged = { ...(await target("soB")), shopId: "shopA" };
    const plan = planTransition({ status: "confirmed", action: "pack", actor: "shop_staff", now: NOW, config: TEST });
    await expect(repo.apply(forged, plan, { id: "u1", role: "shop_staff" }, [])).rejects.toMatchObject({ status: 409 });
    expect(db.shopOrder.rows.find((r) => r.id === "soB")?.status).toBe("confirmed");
  });

  it("runs the hooks inside the transaction: a failing hook rolls everything back", async () => {
    const plan = planTransition({ status: "confirmed", action: "cancel", actor: "admin", input: { reason: "Fraud check" }, now: NOW, config: TEST });
    const hook = vi.fn(async () => {
      throw new Error("ledger down");
    });
    await expect(repo.apply(await target("soB"), plan, { id: "admin", role: "admin" }, [hook])).rejects.toThrow("ledger down");
    expect(hook).toHaveBeenCalledWith(db, expect.objectContaining({ shopOrderId: "soB", to: "cancelled" }));
    expect(db.shopOrder.rows.find((r) => r.id === "soB")?.status).toBe("confirmed");
    expect(db.productVariant.rows.find((v) => v.id === "v3")?.stock).toBe(0);
    expect(db.shopOrderEvent.rows).toEqual([]);
    expect(db.auditLog.rows).toEqual([]);
  });
});

describe("the overdue marker", () => {
  it("finds pre-handover shop orders past the deadline that have not been alerted", async () => {
    expect(ids(await repo.findNewlyOverdue(NOW, 10))).toEqual(["soA"]);
    expect(ids(await repo.findNewlyOverdue(h(11), 10))).toEqual(["soA", "soB"]);
  });

  it("marks once, and not after handover", async () => {
    expect(await repo.markOverdueNotified("soA", NOW)).toBe(true);
    expect(await repo.markOverdueNotified("soA", NOW)).toBe(false);
    expect(await repo.findNewlyOverdue(NOW, 10)).toEqual([]);
    expect(await repo.markOverdueNotified("soC", NOW)).toBe(false);
  });
});

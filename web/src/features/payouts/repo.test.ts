import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "@/lib/testing/fake-db";

// Payout ledger data access: shop reads only return the shop's own rows (ADR-004); a collection
// is recorded once per delivered shop order; a batch takes only the shop's unpaid collections of
// delivered orders (refused/returned excluded), all or nothing; paid/cancel close it.
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  get prisma() {
    return state.db;
  },
}));

const repo = await import("./repo");

type Tables = "shopOrder" | "codCollection" | "payout" | "user";
let db: ReturnType<typeof createFakeDb<Tables>>;
const NOW = new Date("2026-10-17T06:00:00Z");
const d = (days: number) => new Date(NOW.getTime() + days * 86_400_000);

const so = (id: string, shopId: string, status: string, total: string, items: string, commission: string, launchOffer = false) => ({
  id,
  shopId,
  status,
  total,
  itemsSubtotal: items,
  commissionAmount: commission,
  launchOffer,
});

const col = (id: string, shopId: string, shopOrderId: string, amount: string, commission: string, collected: number, payoutId: string | null = null) => ({
  id,
  shopId,
  shopOrderId,
  amount,
  itemsAmount: amount,
  deliveryCharge: "0.00",
  commission,
  collectedAt: d(collected),
  payoutDueAt: d(collected + 10),
  payoutId,
  paidOutAt: null,
});

beforeEach(() => {
  db = createFakeDb<Tables>({
    shopOrder: [
      so("soA1", "shopA", "delivered", "6930.00", "6800.00", "340.00"),
      so("soA2", "shopA", "delivered", "630.00", "500.00", "40.00", true),
      so("soA3", "shopA", "returned", "200.00", "130.00", "13.00"),
      so("soA4", "shopA", "handed_over", "500.00", "430.00", "43.00"),
      so("soA5", "shopA", "delivered", "300.00", "230.00", "23.00"),
      so("soB1", "shopB", "delivered", "1000.00", "930.00", "93.00"),
    ],
    codCollection: [
      col("cA2", "shopA", "soA2", "630.00", "0.00", -4),
      col("cA3", "shopA", "soA3", "200.00", "13.00", -3),
      col("cA5", "shopA", "soA5", "300.00", "23.00", -2, "p-old"),
      col("cB1", "shopB", "soB1", "1000.00", "93.00", -1),
    ],
    payout: [],
    user: [{ id: "admin", email: "admin@x.test", isPlatformAdmin: true, status: "active" }],
  });
  state.db = db;
});

describe("recording a collection", () => {
  it("records a delivered shop order's total, commission and 10-day due date once", async () => {
    const r = await repo.recordCollectionTx(db as never, { shopOrderId: "soA1", collectedAt: NOW, recordedById: "u1", source: "auto_on_delivery", payoutDays: 10 });
    expect(r.created).toBe(true);
    const row = db.codCollection.rows.find((c) => c.shopOrderId === "soA1");
    expect(row).toMatchObject({ shopId: "shopA", amount: "6930.00", itemsAmount: "6800.00", deliveryCharge: "130.00", commission: "340.00", payoutDueAt: d(10), source: "auto_on_delivery" });
    expect(db.auditLog.rows).toEqual([expect.objectContaining({ action: "cod_collection.recorded", actorId: "u1" })]);
    const again = await repo.recordCollectionTx(db as never, { shopOrderId: "soA1", collectedAt: NOW, recordedById: "u1", source: "auto_on_delivery", payoutDays: 10 });
    expect(again).toEqual({ id: r.id, created: false });
  });

  it("refuses a shop order that is not delivered", async () => {
    await expect(repo.recordCollectionTx(db as never, { shopOrderId: "soA4", collectedAt: NOW, recordedById: null, source: "admin_manual", payoutDays: 10 })).rejects.toMatchObject({
      status: 409,
      code: "NOT_DELIVERED",
    });
  });

  it("the admin's manual record says when it already exists", async () => {
    await expect(repo.recordCollectionManually("soA2", "admin", NOW, 10)).rejects.toMatchObject({ code: "ALREADY_RECORDED" });
    expect((await repo.recordCollectionManually("soA1", "admin", NOW, 10)).id).toBeTruthy();
  });
});

describe("shop scoping (ADR-004)", () => {
  it("lists only the shop's own collections and payouts", async () => {
    expect((await repo.listCollectionsForShop("shopA")).map((c) => c.id).sort()).toEqual(["cA2", "cA3", "cA5"]);
    expect((await repo.listCollectionsForShop("shopB")).map((c) => c.id)).toEqual(["cB1"]);
    const p = await repo.createPayoutBatch("shopB", "admin", "shop");
    expect(await repo.listPayoutsForShop("shopA")).toEqual([]);
    expect((await repo.listPayoutsForShop("shopB")).map((x) => x.id)).toEqual([p.id]);
    expect(await repo.getPayoutForShop("shopA", p.id)).toBeNull();
  });
});

describe("payout batches", () => {
  it("takes the shop's unpaid collections of delivered orders only (not returned, not already batched, not another shop's)", async () => {
    await repo.recordCollectionTx(db as never, { shopOrderId: "soA1", collectedAt: d(-1), recordedById: null, source: "auto_on_delivery", payoutDays: 10 });
    const p = await repo.createPayoutBatch("shopA", "admin", "shop");
    // soA1: 6930 - 340; soA2 (launch offer): 630 - 0. Returned soA3 and batched soA5 are left out.
    expect(p).toMatchObject({ shopId: "shopA", collectionCount: 2, gross: "7560.00", commission: "340.00", deliveryCharges: "130.00", deliveryChargesTo: "shop", net: "7220.00", status: "pending" });
    expect(p.periodStart).toEqual(d(-4));
    expect(p.dueAt).toEqual(d(6));
    const batched = db.codCollection.rows.filter((c) => c.payoutId === p.id).map((c) => c.shopOrderId).sort();
    expect(batched).toEqual(["soA1", "soA2"]);
    expect(db.codCollection.rows.find((c) => c.id === "cB1")?.payoutId).toBeNull();
    expect(db.auditLog.rows.at(-1)).toMatchObject({ action: "payout.created", entityId: p.id });
  });

  it("passes delivery charges to the courier when configured", async () => {
    await repo.recordCollectionTx(db as never, { shopOrderId: "soA1", collectedAt: d(-1), recordedById: null, source: "auto_on_delivery", payoutDays: 10 });
    const p = await repo.createPayoutBatch("shopA", "admin", "courier");
    expect(p).toMatchObject({ net: "7090.00", deliveryChargesTo: "courier" });
  });

  it("says when there is nothing to pay", async () => {
    await repo.createPayoutBatch("shopB", "admin", "shop");
    await expect(repo.createPayoutBatch("shopB", "admin", "shop")).rejects.toMatchObject({ status: 409, code: "NOTHING_TO_PAY" });
  });

  it("marks a pending payout paid once, with method and reference, and stamps its collections", async () => {
    const p = await repo.createPayoutBatch("shopB", "admin", "shop");
    await repo.markPayoutPaid(p.id, { method: "bkash", reference: "TRX123" }, "admin", NOW);
    expect(db.payout.rows[0]).toMatchObject({ status: "paid", paidAt: NOW, method: "bkash", reference: "TRX123", recordedById: "admin" });
    expect(db.codCollection.rows.find((c) => c.id === "cB1")?.paidOutAt).toEqual(NOW);
    await expect(repo.markPayoutPaid(p.id, { method: "cash", reference: "again" }, "admin", NOW)).rejects.toMatchObject({ code: "NOT_PENDING" });
    await expect(repo.cancelPayout(p.id, "too late", "admin", NOW)).rejects.toMatchObject({ code: "NOT_PENDING" });
  });

  it("cancels a pending payout and frees its collections for the next batch (nothing deleted)", async () => {
    const p = await repo.createPayoutBatch("shopB", "admin", "shop");
    await repo.cancelPayout(p.id, "Wrong amount", "admin", NOW);
    expect(db.payout.rows[0]).toMatchObject({ status: "cancelled", cancelReason: "Wrong amount" });
    expect(db.codCollection.rows.find((c) => c.id === "cB1")?.payoutId).toBeNull();
    const again = await repo.createPayoutBatch("shopB", "admin", "shop");
    expect(again.id).not.toBe(p.id);
    expect(db.payout.rows).toHaveLength(2);
  });
});

describe("the daily 10-day check", () => {
  it("finds unpaid collections of delivered orders due before a date", async () => {
    const rows = await repo.unpaidCollectionsDueBefore(d(8.5));
    expect(rows.map((r) => r.id).sort()).toEqual(["cA2", "cA5"]); // cA3 returned; cB1 due on day 9
    expect(await repo.adminEmails()).toEqual(["admin@x.test"]);
  });
});

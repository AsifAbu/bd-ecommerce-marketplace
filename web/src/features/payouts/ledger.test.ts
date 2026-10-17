import { describe, expect, it } from "vitest";
import { collectionAmounts, computePayout, dueState, isPayable, loadPayoutConfig, netOf, payoutDueAt } from "./ledger";
import { formatPaisa, paisaToDecimal, sumPaisa, toPaisa } from "./money";
import { summarizeUnbatched, toCollectionView, type CollectionRowLike } from "./views";

// US-082 money: exact paisa arithmetic, rounding to the paisa, the 10-day rule, commission
// (0 under the launch offer), delivery charges as a pass-through, refused/returned excluded.

const NOW = new Date("2026-10-17T06:00:00Z");
const d = (days: number) => new Date(NOW.getTime() + days * 86_400_000);

describe("paisa arithmetic", () => {
  it("parses Decimal strings and numbers exactly", () => {
    expect(toPaisa("1234.56")).toBe(123456);
    expect(toPaisa("70")).toBe(7000);
    expect(toPaisa("0.1")).toBe(10);
    expect(toPaisa("0.50")).toBe(50);
    expect(toPaisa(0.5)).toBe(50);
    expect(toPaisa(19.99)).toBe(1999);
    expect(toPaisa({ toString: () => "6930.00" })).toBe(693000);
    expect(toPaisa("-12.30")).toBe(-1230);
  });

  it("rounds past the paisa half away from zero (where floats go wrong)", () => {
    expect(toPaisa("10.005")).toBe(1001);
    expect(toPaisa("10.0049")).toBe(1000);
    expect(toPaisa(1.005)).toBe(101); // 1.005 * 100 = 100.49999… in floating point
    expect(toPaisa("-0.005")).toBe(-1);
  });

  it("adds without floating-point drift", () => {
    const tenths = Array.from({ length: 10 }, () => toPaisa("0.10"));
    expect(sumPaisa(tenths)).toBe(100);
    expect(paisaToDecimal(sumPaisa([toPaisa("0.1"), toPaisa("0.2")]))).toBe("0.30");
  });

  it("writes Decimals and Tk labels", () => {
    expect(paisaToDecimal(123456)).toBe("1234.56");
    expect(paisaToDecimal(5)).toBe("0.05");
    expect(paisaToDecimal(-1230)).toBe("-12.30");
    expect(formatPaisa(693000)).toBe("Tk 6,930");
    expect(formatPaisa(123405)).toBe("Tk 1,234.05");
    expect(() => paisaToDecimal(1.5)).toThrow();
  });

  it("rejects what is not an amount", () => {
    expect(() => toPaisa("12,50")).toThrow();
    expect(() => toPaisa("abc")).toThrow();
    expect(() => toPaisa("1e5")).toThrow();
    expect(() => toPaisa("99999999999999999999")).toThrow(/range/);
  });
});

describe("a collection", () => {
  it("is the shop order total, split into items and delivery, with the order's commission", () => {
    expect(collectionAmounts({ total: "6930.00", itemsSubtotal: "6800.00", commissionAmount: "340.00", launchOffer: false })).toEqual({
      amount: 693000,
      itemsAmount: 680000,
      deliveryCharge: 13000,
      commission: 34000,
    });
  });

  it("has no commission for orders placed during the launch offer (D15)", () => {
    expect(collectionAmounts({ total: "630.00", itemsSubtotal: "500.00", commissionAmount: "40.00", launchOffer: true }).commission).toBe(0);
  });

  it("handles free delivery and rejects inconsistent amounts", () => {
    expect(collectionAmounts({ total: "2000.00", itemsSubtotal: "2000.00", commissionAmount: "240.00", launchOffer: false }).deliveryCharge).toBe(0);
    expect(() => collectionAmounts({ total: "100.00", itemsSubtotal: "170.00", commissionAmount: "0", launchOffer: false })).toThrow();
    expect(() => collectionAmounts({ total: "170.00", itemsSubtotal: "100.00", commissionAmount: "100.01", launchOffer: false })).toThrow();
  });

  it("is due to the shop 10 days after collection", () => {
    expect(payoutDueAt(NOW).toISOString()).toBe("2026-10-27T06:00:00.000Z");
    expect(payoutDueAt(NOW, 3)).toEqual(d(3));
  });
});

describe("a payout", () => {
  const c = (amount: string, delivery: string, commission: string, collected: number) => ({
    amount,
    deliveryCharge: delivery,
    commission,
    collectedAt: d(collected),
    payoutDueAt: d(collected + 10),
  });
  const batch = [c("6930.00", "130.00", "340.00", -5), c("630.00", "130.00", "40.00", -3), c("170.10", "70.00", "10.01", -1)];

  it("nets collected minus commission; delivery charges stay with the shop that pays its courier (R1)", () => {
    const p = computePayout(batch, "shop");
    expect(p).toMatchObject({ count: 3, gross: 773010, commission: 39001, deliveryCharges: 33000, net: 734009, deliveryChargesTo: "shop" });
    expect(p.periodStart).toEqual(d(-5));
    expect(p.periodEnd).toEqual(d(-1));
    expect(p.dueAt).toEqual(d(5));
  });

  it("passes delivery charges through to the courier when the platform's courier account collects", () => {
    expect(computePayout(batch, "courier").net).toBe(773010 - 39001 - 33000);
  });

  it("is the full amount under the launch offer (commission 0)", () => {
    expect(computePayout([c("630.00", "130.00", "0.00", -2)], "shop").net).toBe(63000);
  });

  it("needs a collection and is never negative", () => {
    expect(() => computePayout([], "shop")).toThrow();
    expect(() => computePayout([c("70.00", "70.00", "10.00", 0)], "courier")).toThrow(/negative/);
  });

  it("per-collection net matches the batch", () => {
    expect(sumPaisa(batch.map((x) => netOf(x, "shop")))).toBe(computePayout(batch, "shop").net);
    expect(sumPaisa(batch.map((x) => netOf(x, "courier")))).toBe(computePayout(batch, "courier").net);
  });

  it("only pays collections of delivered shop orders not batched yet (refused/returned excluded)", () => {
    expect(isPayable({ payoutId: null, shopOrderStatus: "delivered" })).toBe(true);
    expect(isPayable({ payoutId: "p1", shopOrderStatus: "delivered" })).toBe(false);
    expect(isPayable({ payoutId: null, shopOrderStatus: "returned" })).toBe(false);
    expect(isPayable({ payoutId: null, shopOrderStatus: "refused" })).toBe(false);
  });
});

describe("the 10-day rule", () => {
  it("is upcoming, due soon (2 days), overdue, or paid", () => {
    expect(dueState(d(5), null, NOW)).toBe("upcoming");
    expect(dueState(d(2), null, NOW)).toBe("due_soon");
    expect(dueState(d(0.1), null, NOW)).toBe("due_soon");
    expect(dueState(d(-0.1), null, NOW)).toBe("overdue");
    expect(dueState(d(-3), d(-1), NOW)).toBe("paid");
  });

  it("reads the config (auto collection, delivery charges to the shop by default)", () => {
    expect(loadPayoutConfig({})).toEqual({ collectionMode: "auto", deliveryChargesTo: "shop", payoutDays: 10, dueSoonDays: 2 });
    expect(loadPayoutConfig({ COD_COLLECTION_MODE: "manual", PAYOUT_DELIVERY_CHARGES_TO: "courier" })).toMatchObject({ collectionMode: "manual", deliveryChargesTo: "courier" });
  });
});

describe("views", () => {
  const row = (o: { id: string; shopId: string; status?: string; amount?: string; commission?: string; due: number; payoutId?: string | null; paid?: number }): CollectionRowLike => ({
    id: o.id,
    shopId: o.shopId,
    shopOrderId: `so-${o.id}`,
    amount: o.amount ?? "1000.00",
    deliveryCharge: "70.00",
    commission: o.commission ?? "93.00",
    collectedAt: d(o.due - 10),
    source: "auto_on_delivery",
    payoutDueAt: d(o.due),
    payoutId: o.payoutId ?? null,
    paidOutAt: o.paid === undefined ? null : d(o.paid),
    shop: { name: `Shop ${o.shopId}` },
    shopOrder: { seq: 1, status: o.status ?? "delivered", launchOffer: false, order: { orderNo: `BD-261017-${o.id.toUpperCase().padEnd(5, "A")}` } },
  });

  it("summarises unbatched collections per shop, most urgent first, without refused/returned ones", () => {
    const s = summarizeUnbatched(
      [row({ id: "a1", shopId: "A", due: 6 }), row({ id: "a2", shopId: "A", due: 8 }), row({ id: "b1", shopId: "B", due: -1 }), row({ id: "b2", shopId: "B", due: 3, status: "returned" })],
      "shop",
      NOW,
    );
    expect(s.map((x) => [x.shopId, x.state, x.payableCount, x.excludedCount])).toEqual([
      ["B", "overdue", 1, 1],
      ["A", "upcoming", 2, 0],
    ]);
    expect(s[1]).toMatchObject({ gross: 200000, commission: 18600, net: 181400 });
  });

  it("shows a collection's net, due state and whether it is payable", () => {
    expect(toCollectionView(row({ id: "a1", shopId: "A", due: 1 }), "courier", NOW)).toMatchObject({ net: 100000 - 9300 - 7000, dueState: "due_soon", payable: true, shopOrderNo: "BD-261017-A1AAA-1" });
    expect(toCollectionView(row({ id: "a2", shopId: "A", due: -1, status: "returned" }), "shop", NOW).payable).toBe(false);
    expect(toCollectionView(row({ id: "a3", shopId: "A", due: -5, paid: -6, payoutId: "p" }), "shop", NOW)).toMatchObject({ dueState: "paid", payable: true });
  });
});

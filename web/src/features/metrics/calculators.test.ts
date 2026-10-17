import { describe, expect, it } from "vitest";
import { cartToOrderProxy, codSuccessRate, gmvBy, gmvByDay, refusalRate, repeatBuyers, sellerRetention, sumGmv, targetStatus } from "./calculators";
import { dayKeys, dhakaDayKey, lastDays, parseDays, startOfDhakaDay } from "./windows";

describe("Dhaka windows", () => {
  it("rolls the day at 18:00 UTC", () => {
    expect(dhakaDayKey(new Date("2026-10-17T17:59:59Z"))).toBe("2026-10-17");
    expect(dhakaDayKey(new Date("2026-10-17T18:00:00Z"))).toBe("2026-10-18");
    expect(startOfDhakaDay(new Date("2026-10-17T20:00:00Z")).toISOString()).toBe("2026-10-17T18:00:00.000Z");
  });
  it("covers N calendar days including today", () => {
    const w = lastDays(new Date("2026-10-17T10:00:00Z"), 7);
    expect(dayKeys(w)).toEqual(["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"]);
    expect(w.from.toISOString()).toBe("2026-10-10T18:00:00.000Z");
  });
  it("parses the days switch", () => {
    expect(parseDays("90", [7, 30, 90], 30)).toBe(90);
    expect(parseDays("45", [7, 30, 90], 30)).toBe(30);
    expect(parseDays(["7", "30"], [7, 30, 90], 30)).toBe(7);
    expect(parseDays(undefined, [7, 30, 90], 30)).toBe(30);
  });
});

describe("targetStatus", () => {
  it("marks met, not met, no data and tracked", () => {
    expect(targetStatus(0.95, 0.95)).toBe("met");
    expect(targetStatus(0.94, 0.95)).toBe("not_met");
    expect(targetStatus(null, 0.95)).toBe("no_data");
    expect(targetStatus(5, null)).toBe("tracked");
    expect(targetStatus(null, null)).toBe("no_data");
  });
});

describe("GMV", () => {
  const window = lastDays(new Date("2026-10-17T10:00:00Z"), 3);
  const rows = [
    { deliveredAt: new Date("2026-10-15T20:00:00Z"), total: 100.1 }, // 16 Oct Dhaka
    { deliveredAt: new Date("2026-10-16T05:00:00Z"), total: 200.2 }, // 16 Oct
    { deliveredAt: new Date("2026-10-17T05:00:00Z"), total: 50 },
    { deliveredAt: new Date("2026-10-01T05:00:00Z"), total: 999 }, // outside
  ];
  it("sums per Dhaka day with zero days and no float drift", () => {
    const days = gmvByDay(rows, window);
    expect(days).toEqual([
      { day: "2026-10-15", amount: 0, orders: 0 },
      { day: "2026-10-16", amount: 300.3, orders: 2 },
      { day: "2026-10-17", amount: 50, orders: 1 },
    ]);
    expect(sumGmv(days)).toBe(350.3);
  });
  it("groups into weeks (Monday start) and months", () => {
    const days = [
      { day: "2026-10-11", amount: 1, orders: 1 }, // Sunday
      { day: "2026-10-12", amount: 2, orders: 1 }, // Monday
      { day: "2026-11-01", amount: 4, orders: 1 },
    ];
    expect(gmvBy(days, "week").map((d) => d.day)).toEqual(["2026-10-05", "2026-10-12", "2026-10-26"]);
    expect(gmvBy(days, "month")).toEqual([
      { day: "2026-10", amount: 3, orders: 2 },
      { day: "2026-11", amount: 4, orders: 1 },
    ]);
  });
});

describe("order outcome rates", () => {
  it("COD success is delivered / (delivered + refused)", () => {
    expect(codSuccessRate(9, 1)).toBe(0.9);
    expect(codSuccessRate(0, 0)).toBeNull();
    expect(refusalRate(1, 20)).toBe(0.05);
    expect(refusalRate(0, 0)).toBeNull();
  });
});

describe("repeat buyers", () => {
  it("counts buyers with 2+ distinct delivered orders", () => {
    const r = repeatBuyers([
      { buyerKey: "a", orderId: "1" },
      { buyerKey: "a", orderId: "1" }, // two shop orders of one order: not a repeat
      { buyerKey: "b", orderId: "2" },
      { buyerKey: "b", orderId: "3" },
      { buyerKey: "c", orderId: "4" },
    ]);
    expect(r).toEqual({ buyers: 3, repeat: 1, share: 1 / 3 });
    expect(repeatBuyers([]).share).toBeNull();
  });
});

describe("seller retention", () => {
  it("is shops in both windows / shops in the earlier one", () => {
    expect(sellerRetention(new Set(["a", "b", "c", "d"]), new Set(["a", "b", "c", "x"]))).toEqual({ base: 4, kept: 3, rate: 0.75 });
    expect(sellerRetention(new Set(), new Set(["a"])).rate).toBeNull();
  });
});

describe("cart-to-order proxy", () => {
  it("is orders / (orders + open carts)", () => {
    expect(cartToOrderProxy(3, 7)).toBe(0.3);
    expect(cartToOrderProxy(0, 0)).toBeNull();
    expect(cartToOrderProxy(0, 4)).toBe(0);
  });
});

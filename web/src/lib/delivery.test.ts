import { describe, expect, it } from "vitest";
import {
  DEFAULT_DELIVERY_RATES,
  deliveryBreakdown,
  deliveryCharge,
  describeDelivery,
  orderWeightGrams,
  type DeliveryRates,
} from "./delivery";

// D9: Tk 70 inside Dhaka, Tk 130 outside, + Tk 20 per started kg above 1 kg, per shop order.
describe("deliveryCharge", () => {
  it.each([
    [0, 70, 130],
    [1, 70, 130],
    [250, 70, 130],
    [999, 70, 130],
    [1000, 70, 130], // exactly 1 kg: no extra
    [1001, 90, 150], // 1 g over: one started kg
    [1500, 90, 150],
    [2000, 90, 150],
    [2001, 110, 170],
    [3000, 110, 170],
    [10_000, 250, 310], // 9 extra kg
    [10_000.5, 270, 330],
  ])("%d g costs Tk %d inside and Tk %d outside Dhaka", (weightGrams, inside, outside) => {
    expect(deliveryCharge({ insideDhaka: true, weightGrams })).toBe(inside);
    expect(deliveryCharge({ insideDhaka: false, weightGrams })).toBe(outside);
  });

  it("rounds a partial extra kg up, never down", () => {
    expect(deliveryBreakdown({ insideDhaka: true, weightGrams: 1000.1 }).extraKg).toBe(1);
    expect(deliveryBreakdown({ insideDhaka: true, weightGrams: 2999 }).extraKg).toBe(2);
  });

  it("rejects negative and non-numeric weights", () => {
    expect(() => deliveryCharge({ insideDhaka: true, weightGrams: -1 })).toThrow(RangeError);
    expect(() => deliveryCharge({ insideDhaka: true, weightGrams: Number.NaN })).toThrow(RangeError);
    expect(() => deliveryCharge({ insideDhaka: true, weightGrams: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  });

  it("uses rates passed in (admin-set table)", () => {
    const rates: DeliveryRates = { base: { inside_dhaka: 60, outside_dhaka: 120 }, includedGrams: 500, extraPerKg: 25 };
    expect(deliveryCharge({ insideDhaka: true, weightGrams: 500 }, rates)).toBe(60);
    expect(deliveryCharge({ insideDhaka: false, weightGrams: 501 }, rates)).toBe(145);
  });
});

describe("deliveryBreakdown", () => {
  it("returns the parts that add up to the total", () => {
    expect(deliveryBreakdown({ insideDhaka: false, weightGrams: 2500 })).toEqual({
      zone: "outside_dhaka",
      weightGrams: 2500,
      base: 130,
      extraKg: 2,
      extraCharge: 40,
      total: 170,
    });
    expect(deliveryBreakdown({ insideDhaka: true, weightGrams: 800 })).toMatchObject({
      zone: "inside_dhaka",
      base: 70,
      extraKg: 0,
      extraCharge: 0,
      total: 70,
    });
  });

  it("defaults match D9", () => {
    expect(DEFAULT_DELIVERY_RATES).toEqual({ base: { inside_dhaka: 70, outside_dhaka: 130 }, includedGrams: 1000, extraPerKg: 20 });
  });
});

describe("orderWeightGrams", () => {
  it("sums weight × quantity for a shop order", () => {
    expect(orderWeightGrams([])).toBe(0);
    expect(orderWeightGrams([{ weightGrams: 250, quantity: 3 }, { weightGrams: 400, quantity: 1 }])).toBe(1150);
    // 1,150 g crosses the 1 kg boundary: one extra kg.
    expect(deliveryCharge({ insideDhaka: true, weightGrams: 1150 })).toBe(90);
  });
});

describe("describeDelivery", () => {
  it("explains the charge", () => {
    expect(describeDelivery(deliveryBreakdown({ insideDhaka: true, weightGrams: 250 }))).toBe("Tk 70 (up to 1 kg)");
    expect(describeDelivery(deliveryBreakdown({ insideDhaka: false, weightGrams: 1500 }))).toBe(
      "Tk 150 (1.5 kg: Tk 130 + 1 extra kg × Tk 20)",
    );
  });
});

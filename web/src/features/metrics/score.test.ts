import { describe, expect, it } from "vitest";
import { SCORE_MIN_DELIVERED, SCORE_TIERS, SCORE_WEIGHTS } from "./config";
import { computeSellerScore, tierOf, type ScoreInputs } from "./score";

const perfect: ScoreInputs = { deliveredOrders: 20, handoverRate: 1, refusalRate: 0, returnRate: 0, complaintOnTimeRate: 1, averageRating: 5 };

describe("seller score weights", () => {
  it("weights add up to 100", () => {
    expect(Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("tiers are listed best first", () => {
    const mins = SCORE_TIERS.map((t) => t.min);
    expect([...mins].sort((a, b) => b - a)).toEqual(mins);
  });
});

describe("computeSellerScore", () => {
  it("scores 100 for a perfect shop", () => {
    const s = computeSellerScore(perfect);
    expect(s.score).toBe(100);
    expect(s.tier).toBe("excellent");
  });

  it("applies the weights: only handover at 50% costs 15 points", () => {
    expect(computeSellerScore({ ...perfect, handoverRate: 0.5 }).score).toBe(85);
  });

  it("refusal and return rates fall linearly to 0 points at their floors (25%, 20%)", () => {
    expect(computeSellerScore({ ...perfect, refusalRate: 0.125 }).score).toBe(90); // 10 of 20 lost
    expect(computeSellerScore({ ...perfect, refusalRate: 0.4 }).score).toBe(80); // all 20 lost
    expect(computeSellerScore({ ...perfect, returnRate: 0.1 }).score).toBe(90);
    expect(computeSellerScore({ ...perfect, returnRate: 1 }).score).toBe(80);
  });

  it("maps the star rating 1..5 to 0..20 points", () => {
    expect(computeSellerScore({ ...perfect, averageRating: 3 }).score).toBe(90);
    expect(computeSellerScore({ ...perfect, averageRating: 1 }).score).toBe(80);
  });

  it("drops components without data and scales the others up", () => {
    const s = computeSellerScore({ ...perfect, complaintOnTimeRate: null, averageRating: null, handoverRate: 0.9 });
    // used weight 70: (30*0.9 + 20 + 20) / 70 = 67/70
    expect(s.score).toBe(96);
    expect(s.components.find((c) => c.key === "rating")?.points).toBeNull();
    expect(s.components.reduce((a, c) => a + c.effectiveWeight, 0)).toBeCloseTo(100);
    expect(s.components.reduce((a, c) => a + (c.points ?? 0), 0)).toBeCloseTo(67 / 0.7);
  });

  it("is a new seller below the minimum delivered orders", () => {
    const s = computeSellerScore({ ...perfect, deliveredOrders: SCORE_MIN_DELIVERED - 1 });
    expect(s).toMatchObject({ score: null, tier: "new", ordersNeeded: 1 });
    expect(computeSellerScore({ ...perfect, deliveredOrders: SCORE_MIN_DELIVERED }).score).toBe(100);
  });

  it("has no score when there is no data at all", () => {
    const s = computeSellerScore({ deliveredOrders: 9, handoverRate: null, refusalRate: null, returnRate: null, complaintOnTimeRate: null, averageRating: null });
    expect(s.score).toBeNull();
  });

  it("rounds half up and clamps out-of-range inputs", () => {
    expect(computeSellerScore({ ...perfect, handoverRate: 0.985 }).score).toBe(100); // 99.55 -> 100
    expect(computeSellerScore({ ...perfect, handoverRate: 0.9 }).score).toBe(97); // 97.0
    const clamped = computeSellerScore({ ...perfect, handoverRate: 1.4, averageRating: 9, refusalRate: -1 });
    expect(clamped.score).toBe(100);
  });

  it("scores the worst shop 0", () => {
    const s = computeSellerScore({ deliveredOrders: 10, handoverRate: 0, refusalRate: 1, returnRate: 1, complaintOnTimeRate: 0, averageRating: 1 });
    expect(s).toMatchObject({ score: 0, tier: "needs_work" });
  });
});

describe("tierOf", () => {
  it("uses the cut-offs 85 / 70 / 50", () => {
    expect([100, 85, 84, 70, 69, 50, 49, 0].map(tierOf)).toEqual(["excellent", "excellent", "good", "good", "fair", "fair", "needs_work", "needs_work"]);
    expect(tierOf(null)).toBe("new");
  });
});

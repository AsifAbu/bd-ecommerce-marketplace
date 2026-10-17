import { describe, expect, it, vi } from "vitest";
import { createMetricsService, type MetricsDeps } from "./service";

const NOW = new Date("2026-10-17T10:00:00Z");

function deps(over: Partial<MetricsDeps> = {}, repoOver: Partial<MetricsDeps["repo"]> = {}): MetricsDeps {
  return {
    repo: {
      countApprovedShops: async () => 4,
      countLiveListings: async () => 120,
      shopsWithOrders: async (from) => (from.getTime() < NOW.getTime() - 40 * 86_400_000 ? new Set(["a", "b", "c", "d"]) : new Set(["a", "b", "c", "e"])),
      countShopOrdersPlaced: async () => 20,
      countCustomerOrdersPlaced: async () => 6,
      countRefused: async () => 1,
      deliveredRows: async () => [
        { shopId: "a", deliveredAt: new Date("2026-10-16T05:00:00Z"), total: 500 },
        { shopId: "a", deliveredAt: new Date("2026-10-17T05:00:00Z"), total: 250.5 },
        { shopId: "b", deliveredAt: new Date("2026-10-17T06:00:00Z"), total: 100 },
      ],
      deliveredBuyers: async () => [
        { buyerKey: "p1", orderId: "o1" },
        { buyerKey: "p1", orderId: "o2" },
        { buyerKey: "p2", orderId: "o3" },
        { buyerKey: "p3", orderId: "o4" },
      ],
      countOpenCarts: async () => 14,
      shopNames: async (ids) => new Map(ids.map((i) => [i, `Shop ${i}`])),
      outcomeCountsByShop: async () => new Map([["a", { delivered: 10, refused: 0 }]]),
      approvedShopIds: async () => ["a", "b"],
      saveScores: vi.fn(async () => {}),
      ...repoOver,
    },
    handoverRate: async () => ({ rate: 0.96, eligible: 10 }),
    returnStats: async () => ({ deliveredShopOrders: 10, returnRate: 0.1 }),
    complaintStats: async () => ({ opened: 4, closed: 4, closedOnTimeRate: 0.9, overdueNow: 2 }),
    shopRating: async () => ({ count: 3, average: 4.5 }),
    reviewMetrics: async () => ({ averageRating: 4.2, visible: 5 }),
    attention: async () => ({ overdueHandovers: { count: 3, examples: ["X-1"] }, escalatedReturns: { count: 1, examples: [] } }),
    now: () => NOW,
    ...over,
  };
}

describe("dashboard", () => {
  it("computes the tiles and marks them against the targets", async () => {
    const d = await createMetricsService(deps()).dashboard(7);
    const tile = (k: string) => d.tiles.find((t) => t.key === k)!;
    expect(d.days).toBe(7);
    expect(tile("gmv")).toMatchObject({ value: 850.5, status: "tracked" });
    expect(tile("active-shops")).toMatchObject({ value: 4, status: "not_met" });
    expect(tile("live-listings")).toMatchObject({ value: 120, status: "not_met" });
    expect(tile("orders-delivered").value).toBe(3);
    expect(tile("cod-success")).toMatchObject({ value: 0.75, status: "not_met" }); // 3 / (3 + 1)
    expect(tile("refusal-rate").value).toBe(1 / 20);
    expect(tile("repeat-buyers")).toMatchObject({ value: 1 / 3, status: "met" });
    expect(tile("seller-retention")).toMatchObject({ value: 0.75, status: "met" });
    expect(tile("cart-to-order")).toMatchObject({ value: 6 / 20, status: "met" }); // 6 / (6 + 14) = 30%
    expect(tile("handover")).toMatchObject({ value: 0.96, status: "met" });
    expect(tile("complaints")).toMatchObject({ value: 0.9, status: "not_met" });
    expect(tile("rating").value).toBe(4.2);
    expect(d.gmv.byDay).toHaveLength(7);
    expect(d.gmv.total).toBe(850.5);
    expect(d.topShops.map((s) => [s.name, s.gmv])).toEqual([["Shop a", 750.5], ["Shop b", 100]]);
    expect(d.attention.map((a) => a.count)).toEqual([3, 1, 2]);
  });

  it("says no data instead of 0% when nothing happened", async () => {
    const d = await createMetricsService(
      deps(
        { complaintStats: async () => ({ opened: 0, closed: 0, closedOnTimeRate: 1, overdueNow: 0 }), handoverRate: async () => ({ rate: null, eligible: 0 }), returnStats: async () => ({ deliveredShopOrders: 0, returnRate: 0 }) },
        { deliveredRows: async () => [], deliveredBuyers: async () => [], countRefused: async () => 0, countCustomerOrdersPlaced: async () => 0, countOpenCarts: async () => 0, shopsWithOrders: async () => new Set() },
      ),
    ).dashboard(30);
    const status = Object.fromEntries(d.tiles.map((t) => [t.key, t.status]));
    expect(status["cod-success"]).toBe("no_data");
    expect(status["complaints"]).toBe("no_data");
    expect(status["handover"]).toBe("no_data");
    expect(status["seller-retention"]).toBe("no_data");
    expect(status["cart-to-order"]).toBe("no_data");
    expect(status["return-rate"]).toBe("no_data");
    expect(d.gmv.total).toBe(0);
    expect(d.topShops).toEqual([]);
  });
});

describe("seller scores", () => {
  it("stores a score for shops with enough delivered orders and null for new sellers", async () => {
    const d = deps();
    const result = await createMetricsService(d).refreshAll();
    expect(result).toMatchObject({ shops: 2, scored: 1, failures: [] });
    // shop a: handover .96, refusal 0, returns .1 (half of floor .2), complaints .9, rating 4.5 -> 3.5/4
    // 30*.96 + 20*1 + 20*.5 + 10*.9 + 20*.875 = 28.8 + 20 + 10 + 9 + 17.5 = 85.3
    expect(d.repo.saveScores).toHaveBeenCalledWith([{ shopId: "a", score: 85 }, { shopId: "b", score: null }], NOW);
  });

  it("keeps going when one shop fails and reports it", async () => {
    const d = deps({
      shopRating: async (shopId) => {
        if (shopId === "b") throw new Error("boom");
        return { count: 0, average: null };
      },
    });
    const result = await createMetricsService(d).refreshAll();
    expect(result.failures).toEqual([{ shopId: "b", message: "boom" }]);
    expect(d.repo.saveScores).toHaveBeenCalledWith([{ shopId: "a", score: expect.any(Number) }], NOW);
  });

  it("shopScore returns the live breakdown for one shop", async () => {
    const s = await createMetricsService(deps()).shopScore("a");
    expect(s.score).toBe(85);
    expect(s.tier).toBe("excellent");
    expect((await createMetricsService(deps()).shopScore("zzz")).tier).toBe("new");
  });
});

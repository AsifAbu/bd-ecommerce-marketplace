import { complaintStats } from "@/features/complaints/server";
import { handoverRate, shopOrderList } from "@/features/orders/lifecycle/server";
import { returnStats, returnsForAdmin } from "@/features/returns/server";
import { reviewService } from "@/features/reviews/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { parseDays } from "./windows";
import { DEFAULT_WINDOW_DAYS, WINDOW_CHOICES } from "./config";
import * as repo from "./repo";
import { createMetricsService } from "./service";

/**
 * Database-wired metrics: the dashboard for the Platform Admin (US-083) and the seller
 * performance score (US-059). Other features' numbers come only through their public server entries.
 */
export const metricsService = createMetricsService({
  repo,
  handoverRate: (scope, now) => handoverRate(scope, now),
  returnStats,
  complaintStats,
  shopRating: (shopId, window) => reviewService.shopRating(shopId, window),
  reviewMetrics: (range) => reviewService.metrics(range),
  attention: async () => {
    const [overdue, escalated] = await Promise.all([shopOrderList(null, { overdue: true }), returnsForAdmin("escalated")]);
    return {
      overdueHandovers: { count: overdue.overdueCount, examples: overdue.orders.slice(0, 3).map((o) => `${o.shopOrderNo} (${o.shopName})`) },
      escalatedReturns: { count: escalated.length, examples: escalated.slice(0, 3).map((r) => `${r.shopOrderNo} (${r.shopName})`) },
    };
  },
  now: () => new Date(),
});

export const windowDays = (raw: unknown) => parseDays(raw, WINDOW_CHOICES, DEFAULT_WINDOW_DAYS);

/** Admin dashboard data; the caller passes the raw `days` query value. Throws 401/403 for non-admins. */
export async function adminDashboard(rawDays: unknown) {
  await requirePlatformAdmin();
  return metricsService.dashboard(windowDays(rawDays));
}

/** Stored score of one shop: a number, or null for a new seller (public pages; no authorisation needed). */
export async function storedShopScore(shopId: string): Promise<number | null> {
  return (await repo.storedScores([shopId])).get(shopId)?.score ?? null;
}

/** Job `shops.refresh-scores`. */
export const refreshAllScores = () => metricsService.refreshAll();

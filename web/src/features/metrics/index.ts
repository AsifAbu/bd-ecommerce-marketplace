/**
 * Public entry of the metrics feature: the marketplace dashboard (US-083) and the seller
 * performance score (US-059). Pure code and types only; the database-wired parts are in `./server`:
 *
 *   adminDashboard(days)        dashboard data for the Platform Admin (throws 401/403 otherwise)
 *   metricsService.shopScore    a shop's live score with its breakdown (call after the shop guard)
 *   storedShopScore(shopId)     the stored score for public pages (null = "New seller")
 *   refreshAllScores()          the daily shops.refresh-scores job
 *
 * Weights, thresholds, tiers and plan targets are in `./config`.
 */
export { computeSellerScore, tierOf, TIER_LABELS, type ScoreComponent, type ScoreInputs, type SellerScore } from "./score";
export { SCORE_MIN_DELIVERED, SCORE_TIERS, SCORE_WEIGHTS, SCORE_WINDOW_DAYS, TARGETS, WINDOW_CHOICES, type ScoreKey, type ScoreTier } from "./config";
export { STATUS_LABELS, type TargetStatus } from "./calculators";
export { ScoreBadge } from "./ui/score-badge";
export type { MetricsDashboard, Tile } from "./service";

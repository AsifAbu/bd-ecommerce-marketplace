/**
 * Metrics configuration: the plan's success-metric targets (plan v2.4, "Success metrics") and
 * the seller performance score (US-059): weights, thresholds and badge tiers. One place to tune.
 */

/** Weights of the seller score (sum to 100). */
export const SCORE_WEIGHTS = {
  handover: 30, // shop orders handed over to the courier within 48 h
  refusal: 20, // share of dispatched COD parcels the customer refused
  returns: 20, // share of delivered shop orders with an accepted return
  complaints: 10, // complaints closed by their 72 h due time
  rating: 20, // average star rating of visible reviews
} as const;
export type ScoreKey = keyof typeof SCORE_WEIGHTS;

export const SCORE_LABELS: Record<ScoreKey, string> = {
  handover: "Handed over within 48 h",
  refusal: "Parcels not refused",
  returns: "Orders without a return",
  complaints: "Complaints answered in 72 h",
  rating: "Customer rating",
};

/** A rate at or above its "floor" scores 0 points (linear in between): 25% refused, 20% returned. */
export const SCORE_FLOORS = { refusalRate: 0.25, returnRate: 0.2 } as const;

/** The window the score looks at, and the least delivered shop orders in it to be scored at all. */
export const SCORE_WINDOW_DAYS = 90;
export const SCORE_MIN_DELIVERED = 5;

/** Badge tiers by minimum score, best first. Below the last one: "Needs work". */
export const SCORE_TIERS = [
  { key: "excellent", label: "Excellent", min: 85 },
  { key: "good", label: "Good", min: 70 },
  { key: "fair", label: "Fair", min: 50 },
] as const;
export type ScoreTier = (typeof SCORE_TIERS)[number]["key"] | "needs_work" | "new";

/** Plan targets for the marketplace dashboard (US-083). */
export const TARGETS = {
  activeShops: 100,
  liveListings: 5000,
  repeatBuyerShare: 0.25,
  sellerRetention: 0.7,
  codDeliverySuccess: 0.9,
  handoverRate: 0.95,
  complaintsResolved: 0.95,
  cartToOrder: 0.3,
} as const;

/** Fixed windows of the metrics that the plan defines over a set period. */
export const ACTIVE_SHOP_DAYS = 30;
export const REPEAT_BUYER_DAYS = 90;
export const RETENTION_WINDOW_DAYS = 30;

export const WINDOW_CHOICES = [7, 30, 90] as const;
export const DEFAULT_WINDOW_DAYS = 30;

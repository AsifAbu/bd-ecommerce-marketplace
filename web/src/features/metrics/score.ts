import { SCORE_FLOORS, SCORE_LABELS, SCORE_MIN_DELIVERED, SCORE_TIERS, SCORE_WEIGHTS, type ScoreKey, type ScoreTier } from "./config";

/** Facts about one shop over the score window. A `null` rate means "no data" and is left out. */
export interface ScoreInputs {
  deliveredOrders: number;
  /** Handed over within 48 h, 0..1. */
  handoverRate: number | null;
  /** Refused / (delivered + refused), 0..1. */
  refusalRate: number | null;
  /** Delivered shop orders with an accepted return, 0..1. */
  returnRate: number | null;
  /** Complaints closed by their due time / closed, 0..1. */
  complaintOnTimeRate: number | null;
  /** Average star rating, 1..5. */
  averageRating: number | null;
}

export interface ScoreComponent {
  key: ScoreKey;
  label: string;
  weight: number;
  /** 0..1, or null when there is no data. */
  value: number | null;
  /** Points earned after re-weighting (they add up to the score), null when no data. */
  points: number | null;
  /** The weight actually used out of 100 (0 when the component has no data). */
  effectiveWeight: number;
}

export interface SellerScore {
  /** 0..100, or null for a new seller (too few delivered orders). */
  score: number | null;
  tier: ScoreTier;
  components: ScoreComponent[];
  deliveredOrders: number;
  /** Delivered shop orders still needed before a score is shown. */
  ordersNeeded: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
/** 1 at 0%, 0 at the floor (and beyond). */
const lowerIsBetter = (rate: number, floor: number) => clamp01(1 - rate / floor);

export function tierOf(score: number | null): ScoreTier {
  if (score === null) return "new";
  return SCORE_TIERS.find((t) => score >= t.min)?.key ?? "needs_work";
}

export const TIER_LABELS: Record<ScoreTier, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  needs_work: "Needs work",
  new: "New seller",
};

/**
 * Seller performance score 0-100 (US-059). Each component becomes 0..1, then
 * score = round(100 x sum(weight x value) / sum(weight of the components that have data)).
 * A component with no data (no complaints, no reviews, ...) is left out and the other weights
 * are scaled up, so a quiet shop is not punished for missing data.
 * Fewer than SCORE_MIN_DELIVERED delivered shop orders in the window: no score ("New seller").
 */
export function computeSellerScore(i: ScoreInputs): SellerScore {
  const raw: Record<ScoreKey, number | null> = {
    handover: i.handoverRate === null ? null : clamp01(i.handoverRate),
    refusal: i.refusalRate === null ? null : lowerIsBetter(i.refusalRate, SCORE_FLOORS.refusalRate),
    returns: i.returnRate === null ? null : lowerIsBetter(i.returnRate, SCORE_FLOORS.returnRate),
    complaints: i.complaintOnTimeRate === null ? null : clamp01(i.complaintOnTimeRate),
    rating: i.averageRating === null ? null : clamp01((i.averageRating - 1) / 4),
  };
  const keys = Object.keys(SCORE_WEIGHTS) as ScoreKey[];
  const used = keys.reduce((sum, k) => sum + (raw[k] === null ? 0 : SCORE_WEIGHTS[k]), 0);
  const enough = i.deliveredOrders >= SCORE_MIN_DELIVERED && used > 0;
  const components = keys.map((key): ScoreComponent => {
    const value = raw[key];
    const effectiveWeight = value === null || used === 0 ? 0 : (SCORE_WEIGHTS[key] / used) * 100;
    return { key, label: SCORE_LABELS[key], weight: SCORE_WEIGHTS[key], value, effectiveWeight, points: value === null ? null : value * effectiveWeight };
  });
  const total = components.reduce((s, c) => s + (c.points ?? 0), 0);
  const score = enough ? Math.round(total) : null;
  return {
    score,
    tier: tierOf(score),
    components,
    deliveredOrders: i.deliveredOrders,
    ordersNeeded: Math.max(0, SCORE_MIN_DELIVERED - i.deliveredOrders),
  };
}

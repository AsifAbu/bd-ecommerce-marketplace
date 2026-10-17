import { tierOf, TIER_LABELS } from "../score";
import type { ScoreTier } from "../config";

const TIER_STYLE: Record<ScoreTier, string> = {
  excellent: "bg-green-100 text-green-900",
  good: "bg-blue-100 text-blue-900",
  fair: "bg-yellow-100 text-yellow-900",
  needs_work: "bg-red-100 text-red-900",
  new: "bg-gray-100 text-gray-900",
};

/** Seller score badge: "Seller score 88/100 · Excellent", or "New seller" when there is no score yet. */
export function ScoreBadge({ score, testId = "seller-score" }: { score: number | null; testId?: string }) {
  const tier = tierOf(score);
  return (
    <span data-testid={testId} className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-sm font-semibold ${TIER_STYLE[tier]}`}>
      {score === null ? (
        TIER_LABELS.new
      ) : (
        <>
          Seller score {score}/100 <span aria-hidden="true">·</span> {TIER_LABELS[tier]}
        </>
      )}
    </span>
  );
}

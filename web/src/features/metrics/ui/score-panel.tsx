import { SCORE_MIN_DELIVERED, SCORE_TIERS, SCORE_WINDOW_DAYS } from "../config";
import type { SellerScore } from "../score";
import { metricsService } from "../server";
import { ScoreBadge } from "./score-badge";

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** The breakdown of one score (pure; the seller dashboard and tests render it). */
export function ScoreBreakdown({ result }: { result: SellerScore }) {
  return (
    <section aria-labelledby="score-heading" className="flex flex-col gap-3 rounded border border-gray-300 p-4" data-testid="score-panel">
      <h2 id="score-heading" className="text-xl font-semibold">
        Seller performance score
      </h2>
      <p>
        <ScoreBadge score={result.score} testId="dashboard-score" />
      </p>
      {result.score === null ? (
        <p>
          Buyers see &quot;New seller&quot; until you have {SCORE_MIN_DELIVERED} delivered orders in the last {SCORE_WINDOW_DAYS} days
          {result.ordersNeeded > 0 ? ` (${result.ordersNeeded} more to go)` : ""}.
        </p>
      ) : (
        <p>
          Based on the last {SCORE_WINDOW_DAYS} days ({result.deliveredOrders} delivered shop orders). Badges: {SCORE_TIERS.map((t) => `${t.label} ${t.min}+`).join(", ")}. Shown to buyers on your storefront and
          product pages; refreshed every night.
        </p>
      )}
      <table className="w-full max-w-xl border-collapse text-left">
        <caption className="sr-only">How the score is made up</caption>
        <thead>
          <tr>
            <th scope="col" className="border-b border-gray-400 py-1 pr-4">Measure</th>
            <th scope="col" className="border-b border-gray-400 py-1 pr-4 text-right">Result</th>
            <th scope="col" className="border-b border-gray-400 py-1 pr-4 text-right">Weight</th>
            <th scope="col" className="border-b border-gray-400 py-1 text-right">Points</th>
          </tr>
        </thead>
        <tbody>
          {result.components.map((c) => (
            <tr key={c.key}>
              <th scope="row" className="py-1 pr-4 font-normal">{c.label}</th>
              <td className="py-1 pr-4 text-right">{c.value === null ? "No data yet" : pct(c.value)}</td>
              <td className="py-1 pr-4 text-right">{c.weight}%</td>
              <td className="py-1 text-right">{c.points === null ? "–" : c.points.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-sm text-gray-700">
        Result is the score for that measure (100% is best). A measure with no data yet is left out and the others count for more.
      </p>
    </section>
  );
}

/** Seller dashboard section. `shopId` must come from requireShopRole(). */
export async function ScorePanel({ shopId }: { shopId: string }) {
  return <ScoreBreakdown result={await metricsService.shopScore(shopId)} />;
}

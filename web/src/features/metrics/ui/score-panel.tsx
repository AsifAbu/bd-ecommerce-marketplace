import { RowHeader, Section, Table, Td, Th } from "@/components/ui";
import { SCORE_MIN_DELIVERED, SCORE_TIERS, SCORE_WINDOW_DAYS } from "../config";
import type { SellerScore } from "../score";
import { metricsService } from "../server";
import { ScoreBadge } from "./score-badge";

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** The breakdown of one score (pure; the seller dashboard and tests render it). */
export function ScoreBreakdown({ result }: { result: SellerScore }) {
  return (
    <Section title="Seller performance score" className="max-w-2xl" data-testid="score-panel">
      <p>
        <ScoreBadge score={result.score} testId="dashboard-score" />
      </p>
      {result.score === null ? (
        <p className="text-muted">
          Buyers see &quot;New seller&quot; until you have {SCORE_MIN_DELIVERED} delivered orders in the last {SCORE_WINDOW_DAYS} days
          {result.ordersNeeded > 0 ? ` (${result.ordersNeeded} more to go)` : ""}.
        </p>
      ) : (
        <p className="text-muted">
          Based on the last {SCORE_WINDOW_DAYS} days ({result.deliveredOrders} delivered shop orders). Badges: {SCORE_TIERS.map((t) => `${t.label} ${t.min}+`).join(", ")}. Shown to buyers on your storefront and
          product pages; refreshed every night.
        </p>
      )}
      <Table label="How the score is made up">
        <caption className="sr-only">How the score is made up</caption>
        <thead>
          <tr>
            <Th>Measure</Th>
            <Th className="text-right">Result</Th>
            <Th className="text-right">Weight</Th>
            <Th className="text-right">Points</Th>
          </tr>
        </thead>
        <tbody>
          {result.components.map((c) => (
            <tr key={c.key}>
              <RowHeader>{c.label}</RowHeader>
              <Td className="tabular text-right">{c.value === null ? "No data yet" : pct(c.value)}</Td>
              <Td className="tabular text-right">{c.weight}%</Td>
              <Td className="tabular text-right">{c.points === null ? "–" : c.points.toFixed(1)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="text-sm text-muted">
        Result is the score for that measure (100% is best). A measure with no data yet is left out and the others count for more.
      </p>
    </Section>
  );
}

/** Seller dashboard section. `shopId` must come from requireShopRole(). */
export async function ScorePanel({ shopId }: { shopId: string }) {
  return <ScoreBreakdown result={await metricsService.shopScore(shopId)} />;
}

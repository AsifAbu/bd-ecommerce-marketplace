import { Badge, RowHeader, Section, Table, Td, Th, type BadgeTone } from "@/components/ui";
import { DUE_STATE_LABELS, PAYOUT_METHOD_LABELS, type DueState } from "../ledger";
import { formatPaisa } from "../money";
import type { ShopLedger } from "../service";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric" });

const DUE_TONE: Record<DueState, BadgeTone> = { paid: "brand", overdue: "sale", due_soon: "warning", upcoming: "neutral" };

function Due({ state }: { state: DueState | null }) {
  return state ? <Badge tone={DUE_TONE[state]}>{DUE_STATE_LABELS[state]}</Badge> : null;
}

/**
 * The shop owner's payouts page (US-082; reports come with US-054): cash collected for delivered
 * orders, when each is due (within 10 days), commission and what the shop gets, and the payouts.
 */
export function ShopLedgerView({ ledger }: { ledger: ShopLedger }) {
  const { totals } = ledger;
  const stats = [
    { label: "Waiting to be paid", value: formatPaisa(totals.unpaidNet) },
    { label: "Due within 2 days", value: String(totals.dueSoon) },
    { label: "Past the 10-day deadline", value: String(totals.overdue) },
    { label: "Paid so far", value: formatPaisa(totals.paidNet) },
  ];
  return (
    <div className="flex flex-col gap-10">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4" aria-label="Payout summary">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-1">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="tabular text-2xl font-semibold">{s.value}</dd>
          </div>
        ))}
      </dl>
      <p className="max-w-prose text-muted">
        The platform collects the cash on delivery and pays you within 10 days, minus commission (no commission on orders placed during the launch offer).{" "}
        {ledger.deliveryChargesTo === "shop" ? "Delivery charges are paid to you, since you book the courier." : "Delivery charges go to the courier."}
      </p>

      <Section title="Cash collections" id="collections-heading">
        {ledger.collections.length === 0 ? (
          <p className="text-muted">No collections yet. A collection is recorded when an order is delivered.</p>
        ) : (
          <Table label="Cash collections">
            <caption className="sr-only">Cash collections</caption>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Collected</Th>
                <Th className="text-right">Amount</Th>
                <Th className="text-right">Commission</Th>
                <Th className="text-right">You get</Th>
                <Th>Payout</Th>
              </tr>
            </thead>
            <tbody>
              {ledger.collections.map((c) => (
                <tr key={c.id}>
                  <RowHeader className="whitespace-nowrap">{c.shopOrderNo}</RowHeader>
                  <Td className="whitespace-nowrap">{date(c.collectedAt)}</Td>
                  <Td className="tabular whitespace-nowrap text-right">{formatPaisa(c.amount)}</Td>
                  <Td className="tabular whitespace-nowrap text-right">
                    {formatPaisa(c.commission)}
                    {c.launchOffer && <span className="block text-xs text-muted">launch offer</span>}
                  </Td>
                  <Td className="tabular whitespace-nowrap text-right font-semibold">{c.payable ? formatPaisa(c.net) : "–"}</Td>
                  <Td className="min-w-44">
                    {!c.payable ? (
                      <span className="text-muted">Not paid out ({c.shopOrderStatus})</span>
                    ) : c.paidOutAt ? (
                      <>Paid {date(c.paidOutAt)}</>
                    ) : (
                      <span className="flex flex-col items-start gap-1">
                        Due by {date(c.payoutDueAt)} <Due state={c.dueState} />
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      <Section title="Payouts" id="payouts-heading">
        {ledger.payouts.length === 0 ? (
          <p className="text-muted">No payouts yet.</p>
        ) : (
          <Table label="Payouts">
            <caption className="sr-only">Payouts</caption>
            <thead>
              <tr>
                <Th>Orders</Th>
                <Th className="text-right">Collected</Th>
                <Th className="text-right">Commission</Th>
                <Th className="text-right">Paid to you</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {ledger.payouts.map((p) => (
                <tr key={p.id}>
                  <RowHeader className="min-w-36">
                    {p.collectionCount} {p.collectionCount === 1 ? "order" : "orders"}
                    <span className="block text-xs font-normal text-muted">
                      {date(p.periodStart)} to {date(p.periodEnd)}
                    </span>
                  </RowHeader>
                  <Td className="tabular whitespace-nowrap text-right">{formatPaisa(p.gross)}</Td>
                  <Td className="tabular whitespace-nowrap text-right">{formatPaisa(p.commission)}</Td>
                  <Td className="tabular whitespace-nowrap text-right font-semibold">{formatPaisa(p.net)}</Td>
                  <Td className="min-w-44">
                    {p.status === "paid" && p.paidAt ? (
                      <>
                        Paid {date(p.paidAt)} by {PAYOUT_METHOD_LABELS[p.method as keyof typeof PAYOUT_METHOD_LABELS] ?? p.method}, ref. {p.reference}
                      </>
                    ) : p.status === "cancelled" ? (
                      <>Cancelled{p.cancelReason ? `: ${p.cancelReason}` : ""}</>
                    ) : (
                      <>Pending, due by {date(p.dueAt)}</>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>
    </div>
  );
}

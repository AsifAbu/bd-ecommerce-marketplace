import { formatPaisa } from "../money";
import type { ShopLedger } from "../service";
import { DueBadge, PayoutTable } from "./admin-payouts";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric" });

/**
 * The shop owner's payouts page (US-082; reports come with US-054): cash collected for delivered
 * orders, when each is due (within 10 days), commission and what the shop gets, and the payouts.
 */
export function ShopLedgerView({ ledger }: { ledger: ShopLedger }) {
  const { totals } = ledger;
  return (
    <div className="flex flex-col gap-8">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 rounded border border-gray-300 p-4" aria-label="Payout summary">
        <dt className="font-medium">Waiting to be paid</dt>
        <dd>{formatPaisa(totals.unpaidNet)}</dd>
        <dt className="font-medium">Due within 2 days</dt>
        <dd>{totals.dueSoon}</dd>
        <dt className="font-medium">Past the 10-day deadline</dt>
        <dd>{totals.overdue}</dd>
        <dt className="font-medium">Paid so far</dt>
        <dd>{formatPaisa(totals.paidNet)}</dd>
      </dl>
      <p className="text-sm">
        The platform collects the cash on delivery and pays you within 10 days, minus commission (no commission on orders placed during the launch offer).{" "}
        {ledger.deliveryChargesTo === "shop" ? "Delivery charges are paid to you, since you book the courier." : "Delivery charges go to the courier."}
      </p>

      <section aria-labelledby="collections-heading" className="flex flex-col gap-3">
        <h2 id="collections-heading" className="text-xl font-semibold">
          Cash collections
        </h2>
        {ledger.collections.length === 0 ? (
          <p>No collections yet. A collection is recorded when an order is delivered.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th scope="col" className="py-1">
                  Order
                </th>
                <th scope="col" className="py-1">
                  Collected
                </th>
                <th scope="col" className="py-1 text-right">
                  Amount
                </th>
                <th scope="col" className="py-1 text-right">
                  Commission
                </th>
                <th scope="col" className="py-1 text-right">
                  You get
                </th>
                <th scope="col" className="py-1">
                  Payout
                </th>
              </tr>
            </thead>
            <tbody>
              {ledger.collections.map((c) => (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="py-1">{c.shopOrderNo}</td>
                  <td className="py-1">{date(c.collectedAt)}</td>
                  <td className="py-1 text-right">{formatPaisa(c.amount)}</td>
                  <td className="py-1 text-right">
                    {formatPaisa(c.commission)}
                    {c.launchOffer && <span className="block text-xs">launch offer</span>}
                  </td>
                  <td className="py-1 text-right font-semibold">{c.payable ? formatPaisa(c.net) : "—"}</td>
                  <td className="py-1">
                    {!c.payable ? (
                      <>Not paid out ({c.shopOrderStatus})</>
                    ) : c.paidOutAt ? (
                      <>Paid {date(c.paidOutAt)}</>
                    ) : (
                      <span className="flex flex-wrap items-center gap-2">
                        Due by {date(c.payoutDueAt)} <DueBadge state={c.dueState} />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="payouts-heading" className="flex flex-col gap-3">
        <h2 id="payouts-heading" className="text-xl font-semibold">
          Payouts
        </h2>
        <PayoutTable payouts={ledger.payouts} />
      </section>
    </div>
  );
}

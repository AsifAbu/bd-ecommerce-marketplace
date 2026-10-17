import { ActionForm, Field } from "@/components/action-form";
import { cancelPayoutAction, createPayoutAction, markPayoutPaidAction, recordCollectionAction } from "../actions";
import { DUE_STATE_LABELS, PAYOUT_METHOD_LABELS, PAYOUT_METHODS, type DeliveryChargesTo, type DueState } from "../ledger";
import { formatPaisa, toPaisa } from "../money";
import type { PayoutView, ShopDueSummary } from "../views";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric" });

export function DueBadge({ state }: { state: DueState | null }) {
  if (!state) return null;
  const tone = state === "overdue" ? "bg-red-700 text-white" : state === "due_soon" ? "bg-amber-100 text-amber-950" : state === "paid" ? "bg-green-100 text-green-950" : "bg-gray-100 text-gray-900";
  return <span className={`rounded px-2 py-0.5 text-sm font-semibold ${tone}`}>{DUE_STATE_LABELS[state]}</span>;
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export interface UnrecordedDelivery {
  id: string;
  seq: number;
  shopName: string;
  total: { toString(): string };
  deliveredAt: Date | null;
  order: { orderNo: string };
}

/**
 * Admin payouts (US-082): collections due per shop with "Create payout", pending payouts to mark
 * paid (method + reference) or cancel, delivered orders without a recorded collection, and the
 * latest paid payouts.
 */
export function AdminPayouts({
  due,
  pending,
  recent,
  unrecorded,
  deliveryChargesTo,
}: {
  due: ShopDueSummary[];
  pending: PayoutView[];
  recent: PayoutView[];
  unrecorded: UnrecordedDelivery[];
  deliveryChargesTo: DeliveryChargesTo;
}) {
  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm">
        Shops are paid within 10 days of the cash collection, minus commission (0% under the launch offer). Delivery charges go to the{" "}
        {deliveryChargesTo === "shop" ? "shop (it pays its own courier in R1)" : "courier"}.
      </p>

      <Section id="due-heading" title="Collections due">
        {due.length === 0 ? (
          <p>No unpaid collections.</p>
        ) : (
          <ul className="flex flex-col gap-3" aria-label="Collections due per shop">
            {due.map((s) => (
              <li key={s.shopId} className="flex flex-col gap-2 rounded border border-gray-300 p-4" aria-label={`Due: ${s.shopName}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{s.shopName}</h3>
                  <DueBadge state={s.state} />
                </div>
                <p className="text-sm">
                  {s.payableCount} {s.payableCount === 1 ? "collection" : "collections"}: collected {formatPaisa(s.gross)}, commission {formatPaisa(s.commission)},{" "}
                  <strong>pay {formatPaisa(s.net)}</strong>
                  {s.earliestDueAt && <> by {date(s.earliestDueAt)}</>}
                  {s.excludedCount > 0 && <> · {s.excludedCount} excluded (refused or returned after collection)</>}
                </p>
                {s.payableCount > 0 && (
                  <ActionForm action={createPayoutAction} submitLabel="Create payout" label={`Create payout for ${s.shopName}`}>
                    <input type="hidden" name="shopId" value={s.shopId} />
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="pending-heading" title="Pending payouts">
        {pending.length === 0 ? (
          <p>No pending payouts.</p>
        ) : (
          <ul className="flex flex-col gap-3" aria-label="Pending payouts">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 rounded border border-gray-300 p-4" aria-label={`Payout ${p.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">
                    {p.shopName}: {formatPaisa(p.net)}
                  </h3>
                  {p.overdue ? <DueBadge state="overdue" /> : <span className="text-sm">Due by {date(p.dueAt)}</span>}
                </div>
                <PayoutFigures p={p} />
                <ActionForm action={markPayoutPaidAction} submitLabel="Mark paid" label={`Mark payout ${p.id} paid`} className="flex flex-col gap-3">
                  <input type="hidden" name="payoutId" value={p.id} />
                  <Field as="select" name="method" label="Paid by" required options={PAYOUT_METHODS.map((m) => ({ value: m, label: PAYOUT_METHOD_LABELS[m] }))} />
                  <Field name="reference" label="Transaction or cheque reference" required />
                </ActionForm>
                <details>
                  <summary className="cursor-pointer text-sm font-medium">Cancel this payout</summary>
                  <ActionForm action={cancelPayoutAction} submitLabel="Cancel payout" variant="danger" label={`Cancel payout ${p.id}`} className="mt-2 flex flex-col gap-3">
                    <input type="hidden" name="payoutId" value={p.id} />
                    <Field name="reason" label="Reason" required />
                  </ActionForm>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="unrecorded-heading" title="Delivered, collection not recorded">
        {unrecorded.length === 0 ? (
          <p>Every delivered order has its collection recorded.</p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Delivered orders without a collection">
            {unrecorded.map((so) => (
              <li key={so.id} className="flex flex-wrap items-center gap-3 rounded border border-gray-300 p-3">
                <span>
                  {so.order.orderNo}-{so.seq} · {so.shopName} · {formatPaisa(toPaisa(so.total))}
                  {so.deliveredAt && <> · delivered {date(so.deliveredAt.toISOString())}</>}
                </span>
                <ActionForm action={recordCollectionAction} submitLabel="Record cash collected" label={`Record collection for ${so.order.orderNo}-${so.seq}`}>
                  <input type="hidden" name="shopOrderId" value={so.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="paid-heading" title="Recently paid">
        <PayoutTable payouts={recent} showShop />
      </Section>
    </div>
  );
}

function PayoutFigures({ p }: { p: PayoutView }) {
  return (
    <p className="text-sm">
      {p.collectionCount} {p.collectionCount === 1 ? "order" : "orders"} collected {date(p.periodStart)}–{date(p.periodEnd)}: collected {formatPaisa(p.gross)} − commission{" "}
      {formatPaisa(p.commission)}
      {p.deliveryChargesTo === "courier" ? <> − delivery charges to the courier {formatPaisa(p.deliveryCharges)}</> : <> (delivery charges {formatPaisa(p.deliveryCharges)} stay with the shop)</>} ={" "}
      <strong>{formatPaisa(p.net)}</strong>
    </p>
  );
}

export function PayoutTable({ payouts, showShop = false }: { payouts: PayoutView[]; showShop?: boolean }) {
  if (payouts.length === 0) return <p>No payouts yet.</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-gray-300">
          {showShop && (
            <th scope="col" className="py-1">
              Shop
            </th>
          )}
          <th scope="col" className="py-1">
            Orders
          </th>
          <th scope="col" className="py-1 text-right">
            Collected
          </th>
          <th scope="col" className="py-1 text-right">
            Commission
          </th>
          <th scope="col" className="py-1 text-right">
            Paid to shop
          </th>
          <th scope="col" className="py-1">
            Status
          </th>
        </tr>
      </thead>
      <tbody>
        {payouts.map((p) => (
          <tr key={p.id} className="border-b border-gray-100">
            {showShop && <td className="py-1">{p.shopName}</td>}
            <td className="py-1">
              {p.collectionCount} ({date(p.periodStart)}–{date(p.periodEnd)})
            </td>
            <td className="py-1 text-right">{formatPaisa(p.gross)}</td>
            <td className="py-1 text-right">{formatPaisa(p.commission)}</td>
            <td className="py-1 text-right font-semibold">{formatPaisa(p.net)}</td>
            <td className="py-1">
              {p.status === "paid" && p.paidAt ? (
                <>
                  Paid {date(p.paidAt)} by {PAYOUT_METHOD_LABELS[p.method as keyof typeof PAYOUT_METHOD_LABELS] ?? p.method}, ref. {p.reference}
                </>
              ) : p.status === "cancelled" ? (
                <>Cancelled{p.cancelReason ? `: ${p.cancelReason}` : ""}</>
              ) : (
                <>Pending, due by {date(p.dueAt)}</>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

import { ActionForm, Field } from "@/components/action-form";
import { Badge, EmptyState, Notice, Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui";
import { cancelPayoutAction, createPayoutAction, markPayoutPaidAction, recordCollectionAction } from "../actions";
import { DUE_STATE_LABELS, PAYOUT_METHOD_LABELS, PAYOUT_METHODS, type DeliveryChargesTo, type DueState } from "../ledger";
import { formatPaisa, toPaisa } from "../money";
import type { PayoutView, ShopDueSummary } from "../views";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric" });

export function DueBadge({ state }: { state: DueState | null }) {
  if (!state) return null;
  const tone = state === "overdue" ? "sale" : state === "due_soon" ? "warning" : state === "paid" ? "brand" : "neutral";
  return (
    <Badge tone={tone} className="text-sm">
      {DUE_STATE_LABELS[state]}
    </Badge>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
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
    <div className="flex flex-col gap-10">
      <Notice>
        Shops are paid within 10 days of the cash collection, minus commission (0% under the launch offer). Delivery charges go to the{" "}
        {deliveryChargesTo === "shop" ? "shop (it pays its own courier in R1)" : "courier"}.
      </Notice>

      <Section id="due-heading" title="Collections due">
        {due.length === 0 ? (
          <EmptyState title="No unpaid collections" description="Delivered orders with their cash recorded will appear here per shop." />
        ) : (
          <ul className="flex flex-col gap-3" aria-label="Collections due per shop">
            {due.map((s) => (
              <li key={s.shopId} className="flex flex-col gap-2 flash-result rounded-lg border border-line p-4 sm:p-5" aria-label={`Due: ${s.shopName}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">{s.shopName}</h3>
                  <DueBadge state={s.state} />
                </div>
                <p className="text-sm">
                  {s.payableCount} {s.payableCount === 1 ? "collection" : "collections"}: collected {formatPaisa(s.gross)}, commission {formatPaisa(s.commission)},{" "}
                  <strong>pay {formatPaisa(s.net)}</strong>
                  {s.earliestDueAt && <> by {date(s.earliestDueAt)}</>}
                  {s.excludedCount > 0 && <>, {s.excludedCount} excluded (refused or returned after collection)</>}
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
          <p className="text-muted">No pending payouts.</p>
        ) : (
          <ul className="flex flex-col gap-3" aria-label="Pending payouts">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 flash-result rounded-lg border border-line p-4 sm:p-5" aria-label={`Payout ${p.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">
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
          <p className="text-muted">Every delivered order has its collection recorded.</p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Delivered orders without a collection">
            {unrecorded.map((so) => (
              <li key={so.id} className="flex flex-wrap items-center gap-3 flash-result rounded-lg border border-line p-4">
                <span>
                  <strong>
                    {so.order.orderNo}-{so.seq}
                  </strong>
                  , {so.shopName}, {formatPaisa(toPaisa(so.total))}
                  {so.deliveredAt && <>, delivered {date(so.deliveredAt.toISOString())}</>}
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
      {p.collectionCount} {p.collectionCount === 1 ? "order" : "orders"} collected {date(p.periodStart)} to {date(p.periodEnd)}: collected {formatPaisa(p.gross)} − commission{" "}
      {formatPaisa(p.commission)}
      {p.deliveryChargesTo === "courier" ? <> − delivery charges to the courier {formatPaisa(p.deliveryCharges)}</> : <> (delivery charges {formatPaisa(p.deliveryCharges)} stay with the shop)</>} ={" "}
      <strong>{formatPaisa(p.net)}</strong>
    </p>
  );
}

export function PayoutTable({ payouts, showShop = false }: { payouts: PayoutView[]; showShop?: boolean }) {
  if (payouts.length === 0) return <p className="text-muted">No payouts yet.</p>;
  return (
    <Table caption="Payouts">
      <Thead>
        <tr>
          {showShop && <Th>Shop</Th>}
          <Th>Orders</Th>
          <Th align="right">Collected</Th>
          <Th align="right">Commission</Th>
          <Th align="right">Paid to shop</Th>
          <Th>Status</Th>
        </tr>
      </Thead>
      <Tbody>
        {payouts.map((p) => (
          <Tr key={p.id}>
            {showShop && <Td>{p.shopName}</Td>}
            <Td>
              {p.collectionCount} ({date(p.periodStart)} to {date(p.periodEnd)})
            </Td>
            <Td align="right">{formatPaisa(p.gross)}</Td>
            <Td align="right">{formatPaisa(p.commission)}</Td>
            <Td align="right" className="font-semibold">
              {formatPaisa(p.net)}
            </Td>
            <Td>
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
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}

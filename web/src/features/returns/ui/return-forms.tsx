"use client";

import { ActionForm, Field } from "@/components/action-form";
import { adminReturnAction, cancelReturnAction, disputeReturnAction, shopReturnAction } from "../actions";
import { REFUND_METHOD_LABELS, REFUND_METHODS } from "../rules";
import type { ReturnView } from "../views";

/** Action forms on a return card: customer (cancel, dispute), shop (accept, reject, received, refund), admin (approve, deny, refund). */

const methodOptions = REFUND_METHODS.map((m) => ({ value: m, label: REFUND_METHOD_LABELS[m] }));

export function CustomerReturnActions({ view }: { view: ReturnView }) {
  return (
    <>
      {view.canCancel && (
        <ActionForm action={cancelReturnAction} submitLabel="Cancel this request" variant="danger" label={`Cancel return ${view.item.title}`}>
          <input type="hidden" name="returnId" value={view.id} />
        </ActionForm>
      )}
      {view.canDispute && (
        <ActionForm action={disputeReturnAction} submitLabel="Ask the admin to decide" label={`Dispute rejection of ${view.item.title}`}>
          <input type="hidden" name="returnId" value={view.id} />
          <Field as="textarea" name="note" label="Why do you disagree with the shop?" required rows={3} />
        </ActionForm>
      )}
    </>
  );
}

function RefundForm({ view, action, hidden }: { view: ReturnView; action: typeof shopReturnAction; hidden: Record<string, string> }) {
  return (
    <ActionForm action={action} submitLabel="Record refund" label={`Record refund for ${view.item.title}`}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="action" value="refund" />
      <p className="text-sm">
        Up to Tk {view.refundLimit.max}: items Tk {view.refundLimit.items}
        {Number(view.refundLimit.delivery) > 0 ? ` + delivery charge Tk ${view.refundLimit.delivery} (shop at fault)` : ""}. Pay the customer first
        (bKash, Nagad, bank or cash), then record it here.
      </p>
      <Field name="amount" label="Amount refunded (Tk)" type="number" required defaultValue={view.refundLimit.max} />
      <Field as="select" name="method" label="Paid by" required options={methodOptions} />
      <Field name="reference" label="Transaction ID or receipt" required hint="The bKash/Nagad transaction ID, bank reference or cash receipt number." />
      {!view.receivedAt && !view.restocked && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="restock" defaultChecked={view.restockByDefault} /> Put the {view.quantity} unit(s) back in stock
        </label>
      )}
    </ActionForm>
  );
}

function ReceiveForm({ view, action, hidden }: { view: ReturnView; action: typeof shopReturnAction; hidden: Record<string, string> }) {
  return (
    <ActionForm action={action} submitLabel="Mark item received" label={`Mark ${view.item.title} received`}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="action" value="receive" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="restock" defaultChecked={view.restockByDefault} /> Put the {view.quantity} unit(s) back in stock (inspected, sellable)
      </label>
    </ActionForm>
  );
}

const refundable = (v: ReturnView) => v.status === "accepted" || v.status === "approved" || v.status === "received";

export function ShopReturnActions({ shopId, view }: { shopId: string; view: ReturnView }) {
  const hidden = { shopId, returnId: view.id };
  if (view.status === "requested") {
    return (
      <div className="flex flex-col gap-3">
        <ActionForm action={shopReturnAction} submitLabel="Accept return" label={`Accept return of ${view.item.title}`}>
          <input type="hidden" name="shopId" value={shopId} />
          <input type="hidden" name="returnId" value={view.id} />
          <input type="hidden" name="action" value="accept" />
          <Field name="note" label="Note to the customer (optional)" hint="E.g. how the item will be collected." />
        </ActionForm>
        <ActionForm action={shopReturnAction} submitLabel="Reject return" variant="danger" label={`Reject return of ${view.item.title}`}>
          <input type="hidden" name="shopId" value={shopId} />
          <input type="hidden" name="returnId" value={view.id} />
          <input type="hidden" name="action" value="reject" />
          <Field as="textarea" name="note" label="Reason for rejecting" required rows={2} />
        </ActionForm>
      </div>
    );
  }
  if (!refundable(view)) return null;
  return (
    <div className="flex flex-col gap-3">
      {view.status !== "received" && <ReceiveForm view={view} action={shopReturnAction} hidden={hidden} />}
      <RefundForm view={view} action={shopReturnAction} hidden={hidden} />
    </div>
  );
}

export function AdminReturnActions({ view }: { view: ReturnView }) {
  if (view.status === "escalated") {
    return (
      <div className="flex flex-col gap-3">
        <ActionForm action={adminReturnAction} submitLabel="Approve return" label={`Approve return of ${view.item.title}`}>
          <input type="hidden" name="returnId" value={view.id} />
          <input type="hidden" name="action" value="approve" />
          <Field name="note" label="Note (optional)" />
        </ActionForm>
        <ActionForm action={adminReturnAction} submitLabel="Deny return" variant="danger" label={`Deny return of ${view.item.title}`}>
          <input type="hidden" name="returnId" value={view.id} />
          <input type="hidden" name="action" value="deny" />
          <Field as="textarea" name="note" label="Reason for denying" required rows={2} />
        </ActionForm>
      </div>
    );
  }
  if (!refundable(view)) return null;
  // The platform holds COD money in production, so the admin may record the refund too.
  return <RefundForm view={view} action={adminReturnAction} hidden={{ returnId: view.id }} />;
}

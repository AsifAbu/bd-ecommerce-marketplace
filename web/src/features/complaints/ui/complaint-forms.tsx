"use client";

import { ActionForm, Field } from "@/components/action-form";
import { adminComplaintAction, customerReplyAction, openComplaintAction, shopReplyAction } from "../actions";
import { CATEGORY_LABELS, COMPLAINT_CATEGORIES } from "../rules";

const categoryOptions = COMPLAINT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));

/** US-072: open a complaint about an order (and one of its shop orders). */
export function OpenComplaintForm({ orderNo, shopOrders, defaultShopOrderId }: { orderNo: string; shopOrders: { id: string; label: string }[]; defaultShopOrderId?: string }) {
  return (
    <ActionForm action={openComplaintAction} submitLabel="Send complaint" label="Report a problem">
      <input type="hidden" name="orderNo" value={orderNo} />
      {shopOrders.length > 1 ? (
        <Field as="select" name="shopOrderId" label="Which shop order?" options={shopOrders.map((s) => ({ value: s.id, label: s.label }))} defaultValue={defaultShopOrderId} />
      ) : (
        <input type="hidden" name="shopOrderId" value={shopOrders[0]?.id ?? ""} />
      )}
      <Field as="select" name="category" label="What is it about?" required options={categoryOptions} />
      <Field name="subject" label="Subject" required hint="A few words, e.g. “Parcel not delivered”." />
      <Field as="textarea" name="message" label="What happened?" required rows={5} />
    </ActionForm>
  );
}

export function CustomerReplyForm({ ticketId }: { ticketId: string }) {
  return (
    <ActionForm action={customerReplyAction} submitLabel="Send message" label="Reply" resetOnSubmit>
      <input type="hidden" name="ticketId" value={ticketId} />
      <Field as="textarea" name="text" label="Your message" required rows={3} />
    </ActionForm>
  );
}

export function ShopReplyForm({ shopId, ticketId }: { shopId: string; ticketId: string }) {
  return (
    <ActionForm action={shopReplyAction} submitLabel="Send reply" label="Reply to the customer" resetOnSubmit>
      <input type="hidden" name="shopId" value={shopId} />
      <input type="hidden" name="ticketId" value={ticketId} />
      <Field as="textarea" name="text" label="Reply to the customer" required rows={3} />
    </ActionForm>
  );
}

export function AdminComplaintForms({ ticketId, status }: { ticketId: string; status: string }) {
  return (
    <div className="flex flex-col gap-4">
      <ActionForm action={adminComplaintAction} submitLabel="Send reply" label="Admin reply" resetOnSubmit>
        <input type="hidden" name="ticketId" value={ticketId} />
        <input type="hidden" name="action" value="reply" />
        <Field as="textarea" name="text" label="Reply to the customer" required rows={3} />
      </ActionForm>
      {status === "open" && (
        <ActionForm action={adminComplaintAction} submitLabel="Mark in progress" label="Start">
          <input type="hidden" name="ticketId" value={ticketId} />
          <input type="hidden" name="action" value="start" />
        </ActionForm>
      )}
      <ActionForm action={adminComplaintAction} label="Resolve or close">
        <input type="hidden" name="ticketId" value={ticketId} />
        <Field as="textarea" name="resolution" label="Resolution (sent to the customer)" required rows={3} />
        <div className="flex flex-wrap gap-3">
          <button type="submit" name="action" value="resolve" className="rounded bg-green-800 px-4 py-2 font-semibold text-white hover:bg-green-900 focus:outline-2 focus:outline-offset-2 focus:outline-green-800">
            Mark resolved
          </button>
          <button type="submit" name="action" value="close" className="rounded border border-gray-500 px-4 py-2 font-semibold hover:bg-gray-100 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700">
            Close without resolution
          </button>
        </div>
      </ActionForm>
    </div>
  );
}

import type { ReturnEvent } from "./service";

/**
 * Return notifications (US-070, US-071), sent by the `returns.notify` job (SMS through the
 * src/lib/sms adapter, test mode logs; email over SMTP):
 *
 *   requested  -> customer (SMS) and the shop's owner and staff (email)
 *   accepted, rejected, approved, denied, received, refunded -> customer (SMS + email)
 *   escalated  -> customer (SMS + email) and every Platform Admin (email)
 *   approved   -> also the shop (email: collect the item and refund)
 *
 * The builder is pure; the sender throws when a message failed so the job is retried.
 */

export interface ReturnNotifyFacts {
  orderNo: string;
  shopOrderNo: string;
  itemTitle: string;
  quantity: number;
  reasonLabel: string;
  shopName: string;
  shopNote: string | null;
  adminNote: string | null;
  escalationReason: string | null;
  refund: { amount: string; methodLabel: string; reference: string } | null;
  customer: { name: string; phone: string; email: string | null };
  shopEmails: string[];
  adminEmails: string[];
  /** Links: the customer's order page, the seller returns page, the admin returns queue. */
  orderUrl: string;
  sellerUrl: string;
  adminUrl: string;
}

export type ReturnMessage = { channel: "sms"; to: string; text: string } | { channel: "email"; to: string[]; subject: string; text: string };

const what = (f: ReturnNotifyFacts) => `${f.quantity} x ${f.itemTitle} (order ${f.shopOrderNo})`;

function customerText(event: ReturnEvent, f: ReturnNotifyFacts): string | null {
  switch (event) {
    case "requested":
      return `We sent your return request for ${what(f)} to ${f.shopName}. The shop answers within 48 hours. ${f.orderUrl}`;
    case "accepted":
      return `${f.shopName} accepted your return of ${what(f)}. The item will be collected or you can drop it off; the refund follows. ${f.orderUrl}`;
    case "rejected":
      return `${f.shopName} rejected your return of ${what(f)}: ${f.shopNote ?? "no reason given"}. You can ask the admin to decide on the order page. ${f.orderUrl}`;
    case "escalated":
      return f.escalationReason === "customer_dispute"
        ? `Your return of ${what(f)} is now with the marketplace admin, who will decide. ${f.orderUrl}`
        : `${f.shopName} did not answer your return of ${what(f)} within 48 hours, so the marketplace admin will decide. ${f.orderUrl}`;
    case "approved":
      return `The admin approved your return of ${what(f)}. The shop will collect the item and refund you.${f.adminNote ? ` Note: ${f.adminNote}` : ""} ${f.orderUrl}`;
    case "denied":
      return `The admin decided against your return of ${what(f)}: ${f.adminNote ?? ""} ${f.orderUrl}`;
    case "received":
      return `${f.shopName} received your returned ${what(f)}. Your refund is next. ${f.orderUrl}`;
    case "refunded":
      return f.refund
        ? `Refund of Tk ${f.refund.amount} for ${what(f)} paid by ${f.refund.methodLabel}, reference ${f.refund.reference}. ${f.orderUrl}`
        : null;
  }
}

/** The messages for one event. */
export function returnMessages(event: ReturnEvent, f: ReturnNotifyFacts): ReturnMessage[] {
  const out: ReturnMessage[] = [];
  const text = customerText(event, f);
  if (text) {
    out.push({ channel: "sms", to: f.customer.phone, text });
    if (f.customer.email && event !== "requested") {
      out.push({ channel: "email", to: [f.customer.email], subject: `Your return for order ${f.shopOrderNo}`, text: `Hello ${f.customer.name},\n\n${text}\n` });
    }
  }
  if ((event === "requested" || event === "approved") && f.shopEmails.length) {
    const subject = event === "requested" ? `Return request for ${f.shopOrderNo}: answer within 48 h` : `Return approved by the admin: ${f.shopOrderNo}`;
    const body =
      event === "requested"
        ? `A customer asked to return ${what(f)}. Reason: ${f.reasonLabel}.\nAccept or reject it within 48 hours, or it goes to the marketplace admin.\n\n${f.sellerUrl}`
        : `The marketplace admin approved the return of ${what(f)}.${f.adminNote ? `\nNote: ${f.adminNote}` : ""}\nCollect the item, then record the refund.\n\n${f.sellerUrl}`;
    out.push({ channel: "email", to: f.shopEmails, subject, text: body });
  }
  if (event === "escalated" && f.adminEmails.length) {
    const why = f.escalationReason === "customer_dispute" ? "The customer disputes the shop's rejection." : "The shop did not answer within 48 hours.";
    out.push({ channel: "email", to: f.adminEmails, subject: `Return escalated: ${f.shopOrderNo}`, text: `${why}\nReturn of ${what(f)} from ${f.shopName}. Reason: ${f.reasonLabel}.\n\n${f.adminUrl}` });
  }
  return out;
}

export interface ReturnNotifyDeps {
  load(returnId: string): Promise<ReturnNotifyFacts | null>;
  sendSms(phone: string, text: string): Promise<void>;
  sendMail(mail: { to: string[]; subject: string; text: string }): Promise<void>;
}

/** Sends every message; throws after trying all when one failed (the job retries). */
export async function sendReturnNotification(returnId: string, event: ReturnEvent, deps: ReturnNotifyDeps): Promise<{ sent: number }> {
  const facts = await deps.load(returnId);
  if (!facts) return { sent: 0 };
  const failures: string[] = [];
  let sent = 0;
  for (const m of returnMessages(event, facts)) {
    try {
      if (m.channel === "sms") await deps.sendSms(m.to, m.text);
      else await deps.sendMail({ to: m.to, subject: m.subject, text: m.text });
      sent++;
    } catch (err) {
      console.error(`[returns] ${m.channel} for ${returnId} (${event}) failed`, err);
      failures.push(m.channel);
    }
  }
  if (failures.length) throw new Error(`returns.notify ${returnId} ${event}: ${failures.join(", ")} failed`);
  return { sent };
}

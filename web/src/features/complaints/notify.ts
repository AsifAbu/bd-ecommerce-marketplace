import type { AuthorRole } from "./rules";
import type { ComplaintEvent } from "./service";

/**
 * Complaint notifications (US-072: "the customer informed"), sent by the `complaints.notify` job:
 *
 *   opened       -> customer (SMS + email: received, resolved within 72 h), shop and admins (email)
 *   reply        -> from the shop or admin: customer (SMS + email); from the customer: shop and admins
 *   in_progress, resolved, closed -> customer (SMS + email); resolved/closed also the shop (email)
 *   overdue      -> admins (email: past 72 h)
 *
 * The builder is pure; the sender throws when a message failed so the job is retried.
 */

export interface ComplaintNotifyFacts {
  ticketNo: string;
  subject: string;
  statusLabel: string;
  dueAtText: string;
  resolution: string | null;
  orderNo: string | null;
  customer: { name: string; phone: string | null; email: string | null };
  shopEmails: string[];
  adminEmails: string[];
  message: { authorRole: AuthorRole; text: string } | null;
  customerUrl: string;
  sellerUrl: string | null;
  adminUrl: string;
}

export type ComplaintMessageOut = { channel: "sms"; to: string; text: string } | { channel: "email"; to: string[]; subject: string; text: string };

const excerpt = (t: string, n = 140) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

export function complaintMessages(event: ComplaintEvent, f: ComplaintNotifyFacts): ComplaintMessageOut[] {
  const out: ComplaintMessageOut[] = [];
  const toCustomer = (sms: string, emailText = sms) => {
    if (f.customer.phone) out.push({ channel: "sms", to: f.customer.phone, text: sms });
    if (f.customer.email) out.push({ channel: "email", to: [f.customer.email], subject: `Your complaint ${f.ticketNo}: ${f.statusLabel}`, text: `Hello ${f.customer.name},\n\n${emailText}\n\n${f.customerUrl}\n` });
  };
  const toShop = (subject: string, text: string) => {
    if (f.shopEmails.length && f.sellerUrl) out.push({ channel: "email", to: f.shopEmails, subject, text: `${text}\n\n${f.sellerUrl}` });
  };
  const toAdmins = (subject: string, text: string) => {
    if (f.adminEmails.length) out.push({ channel: "email", to: f.adminEmails, subject, text: `${text}\n\n${f.adminUrl}` });
  };
  const about = f.orderNo ? ` about order ${f.orderNo}` : "";

  switch (event) {
    case "opened":
      toCustomer(`We received your complaint ${f.ticketNo}${about}. We will resolve it by ${f.dueAtText} (within 72 hours). ${f.customerUrl}`);
      toShop(`Complaint ${f.ticketNo}${about}`, `A customer raised a complaint: "${f.subject}". Please answer in the thread; it must be resolved by ${f.dueAtText}.`);
      toAdmins(`New complaint ${f.ticketNo} (due ${f.dueAtText})`, `"${f.subject}"${about}.`);
      break;
    case "reply":
      if (!f.message) break;
      if (f.message.authorRole === "customer") {
        const text = `The customer wrote on complaint ${f.ticketNo}: "${excerpt(f.message.text, 500)}"`;
        toShop(`Customer reply on ${f.ticketNo}`, text);
        toAdmins(`Customer reply on ${f.ticketNo}`, text);
      } else {
        const who = f.message.authorRole === "shop" ? "The shop" : "The marketplace admin";
        toCustomer(`${who} answered your complaint ${f.ticketNo} (${f.statusLabel}): "${excerpt(f.message.text)}" ${f.customerUrl}`, `${who} answered your complaint ${f.ticketNo} (status: ${f.statusLabel}):\n\n${f.message.text}`);
      }
      break;
    case "in_progress":
      toCustomer(`Your complaint ${f.ticketNo} is now being handled. Due by ${f.dueAtText}. ${f.customerUrl}`);
      break;
    case "resolved":
    case "closed":
      toCustomer(
        `Your complaint ${f.ticketNo} is ${f.statusLabel.toLowerCase()}: ${excerpt(f.resolution ?? "")} ${f.customerUrl}`,
        `Your complaint ${f.ticketNo} is ${f.statusLabel.toLowerCase()}.\n\n${f.resolution ?? ""}`,
      );
      toShop(`Complaint ${f.ticketNo} ${f.statusLabel.toLowerCase()}`, `The marketplace admin marked the complaint "${f.subject}" ${f.statusLabel.toLowerCase()}:\n\n${f.resolution ?? ""}`);
      break;
    case "overdue":
      toAdmins(`OVERDUE complaint ${f.ticketNo}`, `Complaint "${f.subject}"${about} passed its 72 h (due ${f.dueAtText}) and is still ${f.statusLabel.toLowerCase()}.`);
      break;
  }
  return out;
}

export interface ComplaintNotifyDeps {
  load(ticketId: string, messageId?: string): Promise<ComplaintNotifyFacts | null>;
  sendSms(phone: string, text: string): Promise<void>;
  sendMail(mail: { to: string[]; subject: string; text: string }): Promise<void>;
}

export async function sendComplaintNotification(ticketId: string, event: ComplaintEvent, messageId: string | undefined, deps: ComplaintNotifyDeps): Promise<{ sent: number }> {
  const facts = await deps.load(ticketId, messageId);
  if (!facts) return { sent: 0 };
  const failures: string[] = [];
  let sent = 0;
  for (const m of complaintMessages(event, facts)) {
    try {
      if (m.channel === "sms") await deps.sendSms(m.to, m.text);
      else await deps.sendMail({ to: m.to, subject: m.subject, text: m.text });
      sent++;
    } catch (err) {
      console.error(`[complaints] ${m.channel} for ${ticketId} (${event}) failed`, err);
      failures.push(m.channel);
    }
  }
  if (failures.length) throw new Error(`complaints.notify ${ticketId} ${event}: ${failures.join(", ")} failed`);
  return { sent };
}

import { formatAddress, formatTk, type OrderView } from "./views";

/**
 * Order confirmation (US-051): ONE SMS and ONE email invoice per customer order, listing every
 * shop order with its items, delivery charge and total. Sent by the `orders.notify-placed` job:
 * each channel is marked done when it succeeds, and a failure fails the job so pg-boss retries
 * only what is still missing. Checkout never waits for or fails on it.
 */

export function confirmationSms(order: OrderView, trackUrl: string): string {
  const shops = order.shopOrders.length;
  return (
    `Order ${order.orderNo} placed: ${shops} shop order${shops === 1 ? "" : "s"}, total ${formatTk(order.grandTotal)} ` +
    `cash on delivery. Track: ${trackUrl}`
  );
}

export function invoiceEmail(order: OrderView, trackUrl: string): { subject: string; text: string } {
  const lines: string[] = [
    `Hello ${order.contactName},`,
    "",
    `Thank you for your order ${order.orderNo}. Each shop sends its part separately and charges its own delivery.`,
    "",
  ];
  for (const so of order.shopOrders) {
    lines.push(`Shop order ${so.shopOrderNo} from ${so.shopName}`);
    for (const item of so.items) {
      const variant = item.variantLabel ? ` (${item.variantLabel})` : "";
      lines.push(`  ${item.quantity} x ${item.title}${variant} @ ${formatTk(item.unitPrice)} = ${formatTk(item.lineTotal)}`);
    }
    lines.push(`  Items: ${formatTk(so.itemsSubtotal)}`);
    lines.push(`  Delivery charge: ${so.freeDelivery ? "Free" : formatTk(so.deliveryCharge)}`);
    if (so.vatRate > 0) lines.push(`  VAT included (${so.vatRate}%): ${formatTk(so.vatAmount)}`);
    lines.push(`  Shop order total: ${formatTk(so.total)}`, "");
  }
  lines.push(
    `Items: ${formatTk(order.itemsSubtotal)}`,
    `Delivery charges: ${formatTk(order.deliveryTotal)}`,
    `Total to pay on delivery: ${formatTk(order.grandTotal)}`,
    "",
    "Payment: cash on delivery. Pay each shop's delivery person the shop order total.",
    `Deliver to: ${order.address.name}, ${order.address.phone.replace(/^\+88/, "")}, ${formatAddress(order.address)}`,
    "",
    `Track your order: ${trackUrl}`,
    "",
    "A printable invoice for each shop order is on the order page.",
  );
  return { subject: `Your order ${order.orderNo}: invoice`, text: lines.join("\n") };
}

export interface NotifyDeps {
  load: (orderId: string) => Promise<(OrderView & { contactPhoneE164: string; smsSentAt: Date | null; emailSentAt: Date | null }) | null>;
  sendSms: (phone: string, text: string) => Promise<void>;
  sendMail: (mail: { to: string[]; subject: string; text: string }) => Promise<void>;
  markSent: (orderId: string, channel: "sms" | "email", at: Date) => Promise<void>;
  trackUrl: (orderNo: string) => string;
  now: () => Date;
  log?: (message: string, err?: unknown) => void;
}

/** Sends what is still missing. Throws (so the job is retried) when a channel failed. */
export async function sendOrderConfirmation(orderId: string, deps: NotifyDeps): Promise<{ sms: string; email: string }> {
  const log = deps.log ?? ((m: string, e?: unknown) => console.error(`[orders] ${m}`, e ?? ""));
  const order = await deps.load(orderId);
  if (!order) return { sms: "no order", email: "no order" };
  const url = deps.trackUrl(order.orderNo);
  const result = { sms: "already sent", email: order.contactEmail ? "already sent" : "no email" };
  const failures: string[] = [];

  if (!order.smsSentAt) {
    try {
      await deps.sendSms(order.contactPhoneE164, confirmationSms(order, url));
      await deps.markSent(order.id, "sms", deps.now());
      result.sms = "sent";
    } catch (err) {
      log(`SMS for ${order.orderNo} failed (will retry)`, err);
      result.sms = "failed";
      failures.push("sms");
    }
  }
  if (order.contactEmail && !order.emailSentAt) {
    try {
      const mail = invoiceEmail(order, url);
      await deps.sendMail({ to: [order.contactEmail], ...mail });
      await deps.markSent(order.id, "email", deps.now());
      result.email = "sent";
    } catch (err) {
      log(`email invoice for ${order.orderNo} failed (will retry)`, err);
      result.email = "failed";
      failures.push("email");
    }
  }
  if (failures.length) throw new Error(`orders.notify-placed ${order.orderNo}: ${failures.join(", ")} failed`);
  return result;
}

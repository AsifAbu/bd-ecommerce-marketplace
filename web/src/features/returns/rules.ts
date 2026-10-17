import { ReturnError } from "./errors";

/**
 * Return and refund rules (US-070, US-071; Return and Refund policy). Pure: the clock and the
 * facts are passed in, so every rule is unit-tested.
 *
 * - Window: 7 days from delivery, counted in Bangladesh calendar dates (delivered on 10 Oct: the
 *   last day to ask is 17 Oct).
 * - Reasons: the listing's return_eligibility when it was bought decides. "excluded" listings and
 *   medicine (licence-only categories) take only damaged or wrong items; change of mind only when
 *   the listing allows it.
 * - Quantity: at most what was bought minus what is already being or has been returned; one open
 *   request per item; a rejected or denied request is not asked again (the customer disputes it).
 * - Shop answers within 48 h, else the job escalates to the admin. A rejection can be disputed
 *   for 7 days.
 * - Refund: the item price for the returned units, plus the shop order's delivery charge once when
 *   the shop is at fault (damaged, wrong item, not as described).
 */

export const RETURN_WINDOW_DAYS = 7;
export const SHOP_RESPONSE_HOURS = 48;
export const DISPUTE_WINDOW_DAYS = 7;

export const RETURN_REASONS = ["damaged", "wrong_item", "not_as_described", "change_of_mind", "other"] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];

export const REASON_LABELS: Record<ReturnReason, string> = {
  damaged: "Damaged, defective, incomplete or expired",
  wrong_item: "Wrong item, size or colour",
  not_as_described: "Not as described",
  change_of_mind: "Changed my mind (unworn, with tags)",
  other: "Something else",
};

export const RETURN_STATUSES = [
  "requested",
  "accepted",
  "rejected",
  "escalated",
  "approved",
  "denied",
  "received",
  "refunded",
  "cancelled",
] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: "Waiting for the shop",
  accepted: "Accepted by the shop",
  rejected: "Rejected by the shop",
  escalated: "With the admin to decide",
  approved: "Approved by the admin",
  denied: "Denied by the admin",
  received: "Item received by the shop",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

/** Still being handled: blocks a second request for the same item. */
export const OPEN_RETURN_STATUSES: readonly ReturnStatus[] = ["requested", "accepted", "escalated", "approved", "received"];
/** Units in these requests count as returned (or on their way back). */
export const COUNTED_RETURN_STATUSES: readonly ReturnStatus[] = [...OPEN_RETURN_STATUSES, "refunded"];

export const REFUND_METHODS = ["bkash", "nagad", "bank", "cash"] as const;
export type RefundMethod = (typeof REFUND_METHODS)[number];
export const REFUND_METHOD_LABELS: Record<RefundMethod, string> = { bkash: "bKash", nagad: "Nagad", bank: "Bank transfer", cash: "Cash" };

export type ReturnEligibility = "eligible" | "change_of_mind" | "excluded";

/** The shop is at fault: the delivery charge is refunded too (Return and Refund policy). */
export const SHOP_AT_FAULT: readonly ReturnReason[] = ["damaged", "wrong_item", "not_as_described"];

const DAY_MS = 86_400_000;
const DHAKA_OFFSET_MS = 6 * 3_600_000; // UTC+6, no daylight saving
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Days since 1970-01-01 of the Bangladesh calendar date of `d`. */
export const dhakaDayNumber = (d: Date) => Math.floor((d.getTime() + DHAKA_OFFSET_MS) / DAY_MS);

/** "16 Oct 2026" for a Bangladesh day number. */
export function formatDhakaDay(day: number): string {
  const d = new Date(day * DAY_MS);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export const isReturnEligibility = (v: unknown): v is ReturnEligibility => v === "eligible" || v === "change_of_mind" || v === "excluded";

export interface ItemReturnFacts {
  /** Units bought. */
  quantity: number;
  /** Snapshot at purchase (falls back to the listing's current value for older orders). */
  returnEligibility: ReturnEligibility | null;
  /** In a licence-only (medicine) category. */
  medicine: boolean;
}

export interface ExistingReturn {
  status: ReturnStatus;
  quantity: number;
}

export interface ShopOrderFacts {
  status: string;
  deliveredAt: Date | null;
}

export const MEDICINE_EXCLUSION =
  "Medicine can't be returned unless it arrived damaged, defective, expired or as the wrong item (Return and Refund policy).";
export const EXCLUDED_ITEM =
  "This item is not returnable (food, innerwear, digital or custom-made items) unless it arrived damaged, defective or as the wrong item (Return and Refund policy).";
export const CHANGE_OF_MIND_NOT_ALLOWED =
  "Change of mind returns are only accepted for listings that allow them (fashion, unworn with tags). Choose another reason if the item has a problem.";

/** The reasons this item may be returned for, and why the others are not allowed. */
export function allowedReasons(item: Pick<ItemReturnFacts, "returnEligibility" | "medicine">): { reasons: ReturnReason[]; limitedBecause: string | null } {
  if (item.medicine) return { reasons: ["damaged", "wrong_item"], limitedBecause: MEDICINE_EXCLUSION };
  if (item.returnEligibility === "excluded") return { reasons: ["damaged", "wrong_item"], limitedBecause: EXCLUDED_ITEM };
  if (item.returnEligibility === "change_of_mind") return { reasons: [...RETURN_REASONS], limitedBecause: null };
  return { reasons: ["damaged", "wrong_item", "not_as_described", "other"], limitedBecause: null };
}

/** The last Bangladesh day a return may be asked for, or null when not delivered. */
export function lastReturnDay(deliveredAt: Date | null): number | null {
  return deliveredAt ? dhakaDayNumber(deliveredAt) + RETURN_WINDOW_DAYS : null;
}

export function windowClosedMessage(deliveredAt: Date): string {
  const delivered = dhakaDayNumber(deliveredAt);
  return `Returns are accepted within ${RETURN_WINDOW_DAYS} days of delivery (Return and Refund policy). This item was delivered on ${formatDhakaDay(delivered)}, so the last day to ask was ${formatDhakaDay(delivered + RETURN_WINDOW_DAYS)}.`;
}

/** Units still returnable: bought minus those in open or refunded requests. */
export function returnableQuantity(item: Pick<ItemReturnFacts, "quantity">, existing: readonly ExistingReturn[]): number {
  const counted = existing.filter((r) => COUNTED_RETURN_STATUSES.includes(r.status)).reduce((n, r) => n + r.quantity, 0);
  return Math.max(0, item.quantity - counted);
}

export interface ReturnOptions {
  /** Null when a return can be asked for; else why not (shown instead of the form). */
  blocked: { code: string; message: string } | null;
  reasons: ReturnReason[];
  limitedBecause: string | null;
  maxQuantity: number;
  lastDay: number | null;
}

/** What the customer may ask for this item now (the request form and the request check share it). */
export function returnOptions(shopOrder: ShopOrderFacts, item: ItemReturnFacts, existing: readonly ExistingReturn[], now: Date): ReturnOptions {
  const { reasons, limitedBecause } = allowedReasons(item);
  const lastDay = lastReturnDay(shopOrder.deliveredAt);
  const base = { reasons, limitedBecause, lastDay, maxQuantity: returnableQuantity(item, existing) };
  const block = (code: string, message: string): ReturnOptions => ({ ...base, blocked: { code, message } });

  if (!shopOrder.deliveredAt || (shopOrder.status !== "delivered" && shopOrder.status !== "returned")) {
    return block("NOT_DELIVERED", "A return can be asked for once the order is delivered.");
  }
  if (dhakaDayNumber(now) > lastDay!) return block("RETURN_WINDOW_CLOSED", windowClosedMessage(shopOrder.deliveredAt));
  if (existing.some((r) => OPEN_RETURN_STATUSES.includes(r.status))) {
    return block("RETURN_ALREADY_OPEN", "There is already an open return request for this item. You can follow it on the order page.");
  }
  if (existing.some((r) => r.status === "rejected")) {
    return block("RETURN_REJECTED", "The shop rejected your earlier request for this item. You can ask the admin to decide on that request instead.");
  }
  if (existing.some((r) => r.status === "denied")) {
    return block("RETURN_DENIED", "The admin has already decided against a return of this item.");
  }
  if (base.maxQuantity < 1) return block("RETURN_QUANTITY", "Every unit of this item is already returned.");
  return { ...base, blocked: null };
}

export interface ReturnAsk {
  quantity: number;
  reason: ReturnReason;
  details: string | null;
}

/**
 * Throws a ReturnError unless the customer may ask for this return now: delivered, inside the
 * 7-day window, an allowed reason, no open request and a quantity still returnable.
 */
export function assertCanRequest(shopOrder: ShopOrderFacts, item: ItemReturnFacts, existing: readonly ExistingReturn[], ask: ReturnAsk, now: Date): void {
  const options = returnOptions(shopOrder, item, existing, now);
  if (options.blocked) {
    const status = options.blocked.code === "RETURN_WINDOW_CLOSED" ? 422 : 409;
    throw new ReturnError(status, options.blocked.code, options.blocked.message);
  }
  if (!options.reasons.includes(ask.reason)) {
    // Medicine and excluded listings explain their exclusion; otherwise only change of mind is refused.
    const message = options.limitedBecause ?? CHANGE_OF_MIND_NOT_ALLOWED;
    throw new ReturnError(422, "RETURN_NOT_ELIGIBLE", message, { reason: message });
  }
  if (!Number.isInteger(ask.quantity) || ask.quantity < 1 || ask.quantity > options.maxQuantity) {
    const message = `You can return 1 to ${options.maxQuantity} of this item.`;
    throw new ReturnError(422, "RETURN_QUANTITY", message, { quantity: message });
  }
  if (ask.reason === "other" && (!ask.details || ask.details.trim().length < 10)) {
    throw new ReturnError(422, "VALIDATION", "Tell the shop what is wrong", { details: "Describe the problem (at least 10 characters)" });
  }
}

export const shopDueAt = (requestedAt: Date) => new Date(requestedAt.getTime() + SHOP_RESPONSE_HOURS * 3_600_000);

/** A request the shop has not answered by its due time (the job escalates it). */
export const isShopOverdue = (r: { status: ReturnStatus; shopDueAt: Date }, now: Date) =>
  r.status === "requested" && r.shopDueAt.getTime() <= now.getTime();

// ---------- Transitions ----------

export type ReturnAction = "accept" | "reject" | "cancel" | "dispute" | "escalate" | "approve" | "deny" | "receive" | "refund";

/** Which statuses each action may start from. */
export const TRANSITIONS: Record<ReturnAction, { from: readonly ReturnStatus[]; to: ReturnStatus }> = {
  accept: { from: ["requested"], to: "accepted" },
  reject: { from: ["requested"], to: "rejected" },
  cancel: { from: ["requested"], to: "cancelled" },
  dispute: { from: ["rejected"], to: "escalated" },
  escalate: { from: ["requested"], to: "escalated" },
  approve: { from: ["escalated"], to: "approved" },
  deny: { from: ["escalated"], to: "denied" },
  receive: { from: ["accepted", "approved"], to: "received" },
  refund: { from: ["accepted", "approved", "received"], to: "refunded" },
};

const ACTION_CONFLICT: Record<ReturnAction, string> = {
  accept: "This request was already answered.",
  reject: "This request was already answered.",
  cancel: "This request can only be cancelled before the shop answers.",
  dispute: "Only a request the shop rejected can be sent to the admin.",
  escalate: "Only an unanswered request is escalated.",
  approve: "Only an escalated request can be decided by the admin.",
  deny: "Only an escalated request can be decided by the admin.",
  receive: "Only an accepted or approved return can be marked as received.",
  refund: "A refund is recorded for an accepted, approved or received return that is not refunded yet.",
};

/** The status an action leads to; 409 RETURN_STATE when it is not allowed from `status`. */
export function nextStatus(status: ReturnStatus, action: ReturnAction): ReturnStatus {
  const t = TRANSITIONS[action];
  if (!t.from.includes(status)) throw new ReturnError(409, "RETURN_STATE", ACTION_CONFLICT[action]);
  return t.to;
}

/** A rejection can be sent to the admin for DISPUTE_WINDOW_DAYS after the shop answered. */
export function assertCanDispute(r: { status: ReturnStatus; shopRespondedAt: Date | null }, now: Date): void {
  nextStatus(r.status, "dispute");
  const answered = r.shopRespondedAt?.getTime() ?? 0;
  if (now.getTime() - answered > DISPUTE_WINDOW_DAYS * 86_400_000) {
    throw new ReturnError(409, "DISPUTE_WINDOW_CLOSED", `A rejection can be sent to the admin within ${DISPUTE_WINDOW_DAYS} days.`);
  }
}

// ---------- Refunds ----------

const toPaisa = (tk: number | string) => Math.round(Number(tk) * 100);
const paisaToTk = (p: number) => (p / 100).toFixed(2);

export interface RefundLimit {
  /** Tk with 2 decimals. */
  items: string;
  delivery: string;
  max: string;
}

/**
 * The most that may be refunded: the unit price of the returned units, plus the shop order's
 * delivery charge when the shop is at fault and no earlier refund of that shop order included it.
 */
export function refundLimit(input: { unitPrice: number | string; quantity: number; reason: ReturnReason; deliveryCharge: number | string; deliveryAlreadyRefunded: boolean }): RefundLimit {
  const items = toPaisa(input.unitPrice) * input.quantity;
  const delivery = SHOP_AT_FAULT.includes(input.reason) && !input.deliveryAlreadyRefunded ? toPaisa(input.deliveryCharge) : 0;
  return { items: paisaToTk(items), delivery: paisaToTk(delivery), max: paisaToTk(items + delivery) };
}

/** Checks a refund amount against the limit; returns { amount, delivery } in Tk (2 decimals). */
export function splitRefund(amountTk: number, limit: RefundLimit): { amount: string; delivery: string } {
  const amount = toPaisa(amountTk);
  if (!Number.isFinite(amountTk) || amount <= 0 || amount > toPaisa(limit.max)) {
    const message = `Enter an amount between Tk 0.01 and Tk ${limit.max}.`;
    throw new ReturnError(422, "VALIDATION", message, { amount: message });
  }
  const delivery = Math.min(toPaisa(limit.delivery), Math.max(0, amount - toPaisa(limit.items)));
  return { amount: paisaToTk(amount), delivery: paisaToTk(delivery) };
}

/** True when every unit of every item of the shop order has been refunded. */
export function isFullyReturned(items: readonly { quantity: number; refundedQuantity: number }[]): boolean {
  return items.length > 0 && items.every((i) => i.refundedQuantity >= i.quantity);
}

/** Restock by default, except damaged items (the shop can change it when marking received). */
export const defaultRestock = (reason: ReturnReason) => reason !== "damaged";

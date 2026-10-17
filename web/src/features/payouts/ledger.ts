import { sumPaisa, toPaisa, type MoneyLike } from "./money";

/**
 * The COD collection and payout ledger rules (US-082, D13, D15), pure and unit-tested.
 *
 * - A collection is the cash collected for one delivered shop order: its total (items + delivery
 *   charge), with the commission fixed when the order was placed (0 under the launch offer).
 * - The shop must be paid within 10 days of the collection (Guidelines 2021): payoutDueAt.
 * - A payout batches a shop's unpaid collections of delivered shop orders. Refused, returned or
 *   cancelled shop orders are never paid out.
 * - net = collected − commission − (delivery charges, only when they go to the courier).
 *   Delivery charges are not a profit line: in R1 the shop pays its own courier, so they stay
 *   with the shop; with the platform's courier account they pass through to the courier.
 */

export type DeliveryChargesTo = "shop" | "courier";
export type CollectionMode = "auto" | "manual";

export interface PayoutConfig {
  /** auto: a collection is recorded when the shop order is marked delivered; manual: the admin records it. */
  collectionMode: CollectionMode;
  deliveryChargesTo: DeliveryChargesTo;
  /** Guidelines 2021: sellers paid within this many days. */
  payoutDays: number;
  /** "Due soon" warning this many days before the deadline. */
  dueSoonDays: number;
}

/** `COD_COLLECTION_MODE=auto|manual` (default auto), `PAYOUT_DELIVERY_CHARGES_TO=shop|courier` (default shop). */
export function loadPayoutConfig(env: Record<string, string | undefined> = process.env): PayoutConfig {
  const mode = env.COD_COLLECTION_MODE?.trim().toLowerCase();
  const to = env.PAYOUT_DELIVERY_CHARGES_TO?.trim().toLowerCase();
  return {
    collectionMode: mode === "manual" ? "manual" : "auto",
    deliveryChargesTo: to === "courier" ? "courier" : "shop",
    payoutDays: 10,
    dueSoonDays: 2,
  };
}

let cached: PayoutConfig | undefined;
export function getPayoutConfig(): PayoutConfig {
  cached ??= loadPayoutConfig();
  return cached;
}

const DAY_MS = 24 * 3_600_000;

export const payoutDueAt = (collectedAt: Date, days = 10) => new Date(collectedAt.getTime() + days * DAY_MS);

export interface ShopOrderMoney {
  total: MoneyLike;
  itemsSubtotal: MoneyLike;
  commissionAmount: MoneyLike;
  launchOffer: boolean;
}

export interface CollectionAmounts {
  /** Paisa collected: the shop order total. */
  amount: number;
  itemsAmount: number;
  deliveryCharge: number;
  commission: number;
}

/** What one delivered shop order adds to the ledger (paisa). */
export function collectionAmounts(so: ShopOrderMoney): CollectionAmounts {
  const amount = toPaisa(so.total);
  const itemsAmount = toPaisa(so.itemsSubtotal);
  const deliveryCharge = amount - itemsAmount;
  if (itemsAmount < 0 || deliveryCharge < 0) throw new Error("Shop order amounts are inconsistent (items above the total)");
  // D15: no commission on orders placed during the launch offer, whatever was stored.
  const commission = so.launchOffer ? 0 : toPaisa(so.commissionAmount);
  if (commission < 0 || commission > itemsAmount) throw new Error("Commission must be between 0 and the items amount");
  return { amount, itemsAmount, deliveryCharge, commission };
}

export interface LedgerCollection {
  amount: MoneyLike;
  deliveryCharge: MoneyLike;
  commission: MoneyLike;
  collectedAt: Date;
  payoutDueAt: Date;
}

export interface PayoutTotals {
  count: number;
  /** Paisa collected (items + delivery charges). */
  gross: number;
  commission: number;
  deliveryCharges: number;
  deliveryChargesTo: DeliveryChargesTo;
  /** Paisa paid to the shop. */
  net: number;
  periodStart: Date;
  periodEnd: Date;
  /** Earliest 10-day deadline in the batch. */
  dueAt: Date;
}

export function computePayout(collections: readonly LedgerCollection[], deliveryChargesTo: DeliveryChargesTo): PayoutTotals {
  if (collections.length === 0) throw new Error("A payout needs at least one collection");
  const gross = sumPaisa(collections.map((c) => toPaisa(c.amount)));
  const commission = sumPaisa(collections.map((c) => toPaisa(c.commission)));
  const deliveryCharges = sumPaisa(collections.map((c) => toPaisa(c.deliveryCharge)));
  const net = gross - commission - (deliveryChargesTo === "courier" ? deliveryCharges : 0);
  if (net < 0) throw new Error("A payout can't be negative");
  const times = (pick: (c: LedgerCollection) => Date) => collections.map((c) => pick(c).getTime());
  return {
    count: collections.length,
    gross,
    commission,
    deliveryCharges,
    deliveryChargesTo,
    net,
    periodStart: new Date(Math.min(...times((c) => c.collectedAt))),
    periodEnd: new Date(Math.max(...times((c) => c.collectedAt))),
    dueAt: new Date(Math.min(...times((c) => c.payoutDueAt))),
  };
}

/** What the shop gets for one collection (paisa). */
export function netOf(c: { amount: MoneyLike; deliveryCharge: MoneyLike; commission: MoneyLike }, deliveryChargesTo: DeliveryChargesTo): number {
  return toPaisa(c.amount) - toPaisa(c.commission) - (deliveryChargesTo === "courier" ? toPaisa(c.deliveryCharge) : 0);
}

/** Only collections of delivered shop orders not yet in a payout are paid out. */
export function isPayable(c: { payoutId: string | null; shopOrderStatus: string }): boolean {
  return c.payoutId === null && c.shopOrderStatus === "delivered";
}

export type DueState = "paid" | "overdue" | "due_soon" | "upcoming";

export function dueState(dueAt: Date, paidOutAt: Date | null, now: Date, dueSoonDays = 2): DueState {
  if (paidOutAt) return "paid";
  const left = dueAt.getTime() - now.getTime();
  if (left < 0) return "overdue";
  return left <= dueSoonDays * DAY_MS ? "due_soon" : "upcoming";
}

export const DUE_STATE_LABELS: Record<DueState, string> = {
  paid: "Paid",
  overdue: "Overdue (over 10 days)",
  due_soon: "Due soon",
  upcoming: "Due",
};

export const PAYOUT_METHODS = ["bank_transfer", "bkash", "nagad", "rocket", "cash", "cheque"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];
export const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = {
  bank_transfer: "Bank transfer",
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  cash: "Cash",
  cheque: "Cheque",
};

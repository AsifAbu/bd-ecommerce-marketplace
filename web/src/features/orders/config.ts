/**
 * Orders configuration in one place (US-051, decisions D8, D14, D15). Every value here is a
 * testing value: the final ones are decided before release (pre-release checklist).
 */

export interface OrderConfig {
  /** D8: a mobile (guest or account) may hold this many open COD orders while it has no delivered order. */
  maxOpenCodOrdersWithoutDelivery: number;
  /** D8: this many refused deliveries block cash on delivery for the mobile. */
  refusalsBlockingCod: number;
  /** Guidelines 2021: the shop hands the order to the courier within this many hours. */
  handoverHours: number;
  /**
   * VAT rate (percent) shown on the invoice. Prices are VAT-inclusive, so the invoice shows the
   * VAT contained in the item subtotal. 0 while testing (decision recorded in the README).
   */
  vatRatePercent: number;
  /** D15 launch offer: 0% commission until this moment (null = no offer, category rates apply). */
  launchOfferUntil: Date | null;
  /** How long a verified guest mobile stays valid for placing the order. */
  phoneProofTtlMs: number;
  /** How long a guest can open an order page after placing or tracking it (no account needed). */
  orderAccessTtlMs: number;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Reads the config. `COMMISSION_LAUNCH_OFFER_UNTIL` (ISO date) turns on the D15 offer; `VAT_RATE_PERCENT` sets the VAT rate. */
export function loadOrderConfig(env: Record<string, string | undefined> = process.env): OrderConfig {
  const vat = Number(env.VAT_RATE_PERCENT ?? "0");
  return {
    maxOpenCodOrdersWithoutDelivery: 3,
    refusalsBlockingCod: 2,
    handoverHours: 48,
    vatRatePercent: Number.isFinite(vat) && vat >= 0 && vat <= 100 ? vat : 0,
    launchOfferUntil: parseDate(env.COMMISSION_LAUNCH_OFFER_UNTIL),
    phoneProofTtlMs: 30 * 60_000,
    orderAccessTtlMs: 60 * 60_000,
  };
}

let cached: OrderConfig | undefined;
export function getOrderConfig(): OrderConfig {
  cached ??= loadOrderConfig();
  return cached;
}

/** Shop-order statuses that still count as "open" (D8 and the D14 Basic-shop limit). */
export const OPEN_STATUSES = ["placed", "confirmed", "packed", "handed_over"] as const;
/** Statuses that mean the customer received the goods (a return comes after a delivery). */
export const DELIVERED_STATUSES = ["delivered", "returned"] as const;

export type ShopOrderStatus = "placed" | "confirmed" | "packed" | "handed_over" | "delivered" | "cancelled" | "refused" | "returned";

export const STATUS_LABELS: Record<ShopOrderStatus, string> = {
  placed: "Placed, waiting for the shop",
  confirmed: "Confirmed by the shop",
  packed: "Packed",
  handed_over: "With the courier",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refused: "Delivery refused",
  returned: "Returned",
};

export const isOpenStatus = (s: string) => (OPEN_STATUSES as readonly string[]).includes(s);

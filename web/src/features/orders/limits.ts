import type { OrderConfig } from "./config";
import { OrderError } from "./errors";

/**
 * Fake-order limits (D8) and the Basic-shop open-order limit (D14). Pure, unit-tested.
 * The COD history is counted for one mobile number across guest and account orders (and the
 * account's own orders, should it have changed its number).
 */

export interface CodHistory {
  /** Customer orders with at least one shop order still open (placed … handed over). */
  openOrders: number;
  /** Shop orders delivered (or delivered and later returned). */
  delivered: number;
  /** Shop orders whose COD delivery was refused. */
  refused: number;
}

export const COD_BLOCKED_MESSAGE =
  "Cash on delivery is not available for this mobile number because earlier deliveries were refused. Contact support if you think this is a mistake.";

export function openLimitMessage(max: number): string {
  return `You already have ${max} open cash-on-delivery orders. You can place a new order once one of them is delivered.`;
}

/** Throws 403 COD_BLOCKED or 409 OPEN_ORDER_LIMIT; returns quietly when the order may be placed. */
export function assertCodAllowed(history: CodHistory, config: Pick<OrderConfig, "maxOpenCodOrdersWithoutDelivery" | "refusalsBlockingCod">): void {
  if (history.refused >= config.refusalsBlockingCod) {
    throw new OrderError(403, "COD_BLOCKED", COD_BLOCKED_MESSAGE);
  }
  if (history.delivered === 0 && history.openOrders >= config.maxOpenCodOrdersWithoutDelivery) {
    throw new OrderError(409, "OPEN_ORDER_LIMIT", openLimitMessage(config.maxOpenCodOrdersWithoutDelivery));
  }
}

/**
 * D14: a Basic shop may hold `maxOpenOrders` open shop orders. Throws 409 SHOP_ORDER_LIMIT naming
 * the shops that are full (fields keyed by shop id), so the customer can save their items for later.
 */
export function assertShopsCanTakeOrders(
  shops: readonly { id: string; name: string; maxOpenOrders: number | null; openOrders: number }[],
): void {
  const full = shops.filter((s) => s.maxOpenOrders !== null && s.openOrders >= s.maxOpenOrders);
  if (full.length === 0) return;
  const names = full.map((s) => s.name).join(", ");
  throw new OrderError(
    409,
    "SHOP_ORDER_LIMIT",
    `${names} can't take more orders right now. Save ${full.length === 1 ? "its items" : "their items"} for later to order the rest.`,
    Object.fromEntries(full.map((s) => [s.id, `${s.name} has reached its limit of ${s.maxOpenOrders} open orders.`])),
  );
}

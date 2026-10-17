/**
 * Public entry of the orders feature (checkout and orders: US-051, US-052, US-007 to US-009).
 * Pure code and types only; the database-, cookie- and session-wired parts are in `./server`:
 *
 *   placementService.place(cmd)          COD order placement (used by POST /api/checkout)
 *   ordersApi.*                          the JSON route handlers
 *   viewableOrder(orderNo)               the order this request may see (own, or a guest grant)
 *   ordersOfUser(userId)                 My orders
 *   invoiceOrder(orderNo, shopOrderId, isMember)  printable invoice access (customer or that shop)
 *   shopOrdersOf(shopId, status?)        seller list, scoped by the guard-checked shopId
 *   linkGuestOrdersFor(userId)           US-009 linking (login, sign-up, phone/email verified)
 *   notifyOrderPlaced(orderId)           the orders.notify-placed job
 *
 * Sprint 7 (order lifecycle, returns, complaints, reviews, payouts) builds on the statuses and
 * config below and on the shop_order rows (status, statusChangedAt, handoverDueAt, cancelReason,
 * deliveredAt, commissionAmount, launchOffer) and order_item snapshots.
 */
export {
  DELIVERED_STATUSES,
  getOrderConfig,
  isOpenStatus,
  loadOrderConfig,
  OPEN_STATUSES,
  STATUS_LABELS,
  type OrderConfig,
  type ShopOrderStatus,
} from "./config";
export { OrderError } from "./errors";
export { assertCodAllowed, assertShopsCanTakeOrders, type CodHistory } from "./limits";
export { generateOrderNo, parseOrderNo, shopOrderNo } from "./order-no";
export {
  formatAddress,
  formatDhakaTime,
  formatTk,
  localPhone,
  summaryStatus,
  toOrderView,
  type OrderItemView,
  type OrderView,
  type ShopOrderView,
} from "./views";

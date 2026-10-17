/**
 * Public entry of the returns feature (US-070, US-071). Pure rules and types only; the wired parts
 * are in `./server`:
 *
 *   returnsService.request/cancel/dispute/accept/reject/decide/receive/refund/escalateOverdue
 *   returnsApi.*                        the JSON route handlers
 *   returnsOfUser/Order/Shop, returnsForAdmin   page lists (scoped)
 *   escalateOverdueReturns, notifyReturn        the worker jobs
 *   refundsByShopOrder(shopId, ids?)    payouts (US-082): refunded Tk per shop order, to deduct
 *   returnStats({ shopId?, from, to })  seller score (US-059) and metrics (US-083): return rate, refunds
 */
export {
  allowedReasons,
  assertCanRequest,
  COUNTED_RETURN_STATUSES,
  dhakaDayNumber,
  formatDhakaDay,
  isFullyReturned,
  OPEN_RETURN_STATUSES,
  REASON_LABELS,
  REFUND_METHOD_LABELS,
  REFUND_METHODS,
  refundLimit,
  RETURN_REASONS,
  RETURN_STATUS_LABELS,
  RETURN_STATUSES,
  RETURN_WINDOW_DAYS,
  returnOptions,
  SHOP_RESPONSE_HOURS,
  type RefundMethod,
  type ReturnReason,
  type ReturnStatus,
} from "./rules";
export { ReturnError } from "./errors";
export type { ReturnView } from "./views";

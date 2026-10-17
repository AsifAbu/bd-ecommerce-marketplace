/**
 * Public entry of the payouts feature (COD collections and shop payouts: US-082, D13, D15).
 * Pure code and types only; the database-wired parts are in `./server`:
 *
 *   payoutService.shopLedger(shopId)        the shop's collections, due dates and payouts (owner only)
 *   payoutService.adminOverview()           collections due per shop, pending and paid payouts
 *   payoutService.createBatch / markPaid / cancel / recordCollection   admin ledger writes
 *   payoutsApi.*                            the JSON route handlers
 *   recordCollectionOnDelivery(tx, event)   order-lifecycle hook (auto mode)
 *   checkPayoutsDue()                       the daily payouts.due-check job
 *
 * Reports (US-054, US-083) read the ledger through these views; amounts are whole paisa.
 */
export {
  collectionAmounts,
  computePayout,
  dueState,
  DUE_STATE_LABELS,
  getPayoutConfig,
  isPayable,
  loadPayoutConfig,
  netOf,
  PAYOUT_METHOD_LABELS,
  PAYOUT_METHODS,
  payoutDueAt,
  type CollectionMode,
  type DeliveryChargesTo,
  type DueState,
  type PayoutConfig,
  type PayoutMethod,
  type PayoutTotals,
} from "./ledger";
export { formatPaisa, paisaToDecimal, toPaisa } from "./money";
export { PayoutError } from "./errors";
export type { CollectionView, PayoutView, ShopDueSummary } from "./views";
export type { ShopLedger } from "./service";

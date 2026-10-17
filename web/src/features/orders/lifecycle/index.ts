/**
 * Order lifecycle (US-053), pure part. The database-wired part is `./server`:
 *
 *   lifecycle.asShop / asAdmin / asSystem / cancelAsCustomer   status changes (one transaction each,
 *                                     restock on cancel, ShopOrderEvent + audit log, hooks)
 *   lifecycleApi.*                    the JSON route handlers
 *   checkHandovers() / notifyOverdue(id)   the orders.handover-check / orders.notify-overdue jobs
 *   handoverRate({ shopId, from, to })     share handed over within 48 h (US-059, US-083)
 *   orderTimelines(orderId)           customer timelines
 *
 * Other features hook into status changes in `./server` (TX_HOOKS inside the transaction,
 * AFTER_HOOKS after it): the payout ledger records the COD collection on "delivered".
 */
export {
  ACTION_LABELS,
  actorAllowed,
  availableActions,
  LIFECYCLE_ACTIONS,
  loadLifecycleConfig,
  parseAction,
  planTransition,
  PRE_HANDOVER_STATUSES,
  type ActorRole,
  type LifecycleAction,
  type LifecycleConfig,
  type TransitionInput,
  type TransitionPlan,
} from "./machine";
export { computeHandoverRate, handoverCountdown, HANDOVER_RATE_TARGET, isOverdue, type HandoverFacts, type HandoverRate } from "./handover";
export { buildTimeline, type TimelineEntry } from "./timeline";
export type { ShopOrderTransitionEvent, TransitionAfterHook, TransitionTxHook } from "./service";
export type { ShopOrderDetailView, ShopOrderListView } from "./views";

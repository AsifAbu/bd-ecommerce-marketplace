import type { ShopOrderStatus } from "../config";
import { OrderError } from "../errors";
import { planTransition, shopActor, type ActorRole, type LifecycleAction, type LifecycleConfig, type TransitionInput, type TransitionPlan } from "./machine";

/**
 * Order lifecycle service (US-053): who may change which shop order, in one place. Every entry
 * point takes its scope from a checked guard (ADR-004): a shop only reaches its own shop orders,
 * a customer only the shop orders of an order they may see, the admin any. Dependencies are
 * injected so the rules are unit-tested without a database.
 */

/** The shop order being changed (as read inside the caller's scope). */
export interface LifecycleTarget {
  id: string;
  shopId: string;
  orderId: string;
  orderNo: string;
  seq: number;
  status: ShopOrderStatus;
}

export interface Actor {
  id: string | null;
  role: ActorRole;
}

/** What happened: passed to the in-transaction hooks (e.g. the COD collection) and after-hooks. */
export interface ShopOrderTransitionEvent {
  shopOrderId: string;
  shopId: string;
  orderId: string;
  orderNo: string;
  shopOrderNo: string;
  action: LifecycleAction;
  from: ShopOrderStatus;
  to: ShopOrderStatus;
  at: Date;
  actorId: string | null;
  actorRole: ActorRole;
  note: string | null;
  restocked: boolean;
  /** Products whose stock went back up (search re-index). */
  restockedProductIds: string[];
}

/** Runs inside the status-change transaction; a throw rolls the whole change back. */
export type TransitionTxHook<Tx> = (tx: Tx, event: ShopOrderTransitionEvent) => Promise<void>;
/** Runs after the commit; failures are logged and never undo or block the change. */
export type TransitionAfterHook = (event: ShopOrderTransitionEvent) => Promise<void> | void;

export interface LifecycleStore<Tx> {
  findForShop(shopId: string, shopOrderId: string): Promise<LifecycleTarget | null>;
  /** A shop order of this customer order (the caller checked the customer may see the order). */
  findForOrder(orderId: string, shopOrderId: string): Promise<LifecycleTarget | null>;
  findById(shopOrderId: string): Promise<LifecycleTarget | null>;
  /**
   * One transaction: the status update only if the shop order is still in `plan.from` (else
   * 409 STATUS_CHANGED), the restock, the ShopOrderEvent and audit-log rows, then the hooks.
   */
  apply(target: LifecycleTarget, plan: TransitionPlan, actor: Actor, hooks: readonly TransitionTxHook<Tx>[]): Promise<ShopOrderTransitionEvent>;
}

export interface LifecycleDeps<Tx> {
  store: LifecycleStore<Tx>;
  config: LifecycleConfig;
  now: () => Date;
  txHooks?: readonly TransitionTxHook<Tx>[];
  afterHooks?: readonly TransitionAfterHook[];
  log?: (message: string, err: unknown) => void;
}

const notFound = () => new OrderError(404, "NOT_FOUND", "Order not found");

export function createLifecycleService<Tx>(deps: LifecycleDeps<Tx>) {
  const log = deps.log ?? ((message, err) => console.error(message, err));

  async function run(target: LifecycleTarget | null, actor: Actor, action: LifecycleAction, input?: TransitionInput) {
    if (!target) throw notFound();
    const plan = planTransition({ status: target.status, action, actor: actor.role, input, now: deps.now(), config: deps.config });
    const event = await deps.store.apply(target, plan, actor, deps.txHooks ?? []);
    for (const hook of deps.afterHooks ?? []) {
      try {
        await hook(event);
      } catch (err) {
        log(`[orders] after-transition hook failed (${event.shopOrderNo} ${event.action})`, err);
      }
    }
    return event;
  }

  return {
    /** Shop owner or staff, scoped by the guard-checked shopId. */
    asShop(access: { shopId: string; role: "owner" | "staff"; userId: string }, shopOrderId: string, action: LifecycleAction, input?: TransitionInput) {
      return deps.store.findForShop(access.shopId, shopOrderId).then((t) => run(t, { id: access.userId, role: shopActor(access.role) }, action, input));
    },

    /** Platform Admin (guard-checked by the caller). */
    asAdmin(adminId: string, shopOrderId: string, action: LifecycleAction, input?: TransitionInput) {
      return deps.store.findById(shopOrderId).then((t) => run(t, { id: adminId, role: "admin" }, action, input));
    },

    /** Other features and jobs (returns: delivered -> returned; a courier feed later: delivered/refused). */
    asSystem(shopOrderId: string, action: LifecycleAction, input?: TransitionInput) {
      return deps.store.findById(shopOrderId).then((t) => run(t, { id: null, role: "system" }, action, input));
    },

    /**
     * The customer cancels before the shop confirms. `order` is one the caller may see (own order
     * or a guest's OTP grant); a shop order of another order is "not found".
     */
    cancelAsCustomer(order: { id: string } | null, userId: string | null, shopOrderId: string, reason?: unknown) {
      if (!order) return Promise.reject(notFound());
      return deps.store.findForOrder(order.id, shopOrderId).then((t) => run(t, { id: userId, role: "customer" }, "cancel", { reason }));
    },
  };
}

export type LifecycleService = ReturnType<typeof createLifecycleService>;

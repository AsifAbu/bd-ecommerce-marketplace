import type { ShopOrderStatus } from "../config";
import { OrderError } from "../errors";

/**
 * The shop-order lifecycle (US-053) as a pure state machine:
 *
 *   placed -> confirmed -> packed -> handed_over -> delivered | refused
 *   placed | confirmed | packed -> cancelled      (shop or admin, with a reason; customer only while placed)
 *   refused -> returned                           (the refused parcel is back at the shop: restocked)
 *   delivered -> returned                         (a customer return, US-070/071: admin or the returns feature)
 *
 * No courier integration in R1 (D4): shop staff mark delivered / refused by hand while
 * `shopMarksDelivery` is on (test mode by default), the admin always can. Every change sets
 * statusChangedAt and its own timestamp, and is written as a ShopOrderEvent (the audit trail).
 *
 * Stock: a cancellation puts the items back in the same transaction. A refused delivery does NOT
 * (the parcel is still with the courier); it is restocked when marked returned. A delivered order
 * that comes back is restocked only if the returns feature says so (after inspection).
 */

export type LifecycleAction = "confirm" | "pack" | "hand_over" | "deliver" | "refuse" | "cancel" | "mark_returned";
export type ActorRole = "shop_owner" | "shop_staff" | "customer" | "admin" | "system";

export const LIFECYCLE_ACTIONS: readonly LifecycleAction[] = ["confirm", "pack", "hand_over", "deliver", "refuse", "cancel", "mark_returned"];

export const ACTION_LABELS: Record<LifecycleAction, string> = {
  confirm: "Confirm order",
  pack: "Mark packed",
  hand_over: "Hand over to courier",
  deliver: "Mark delivered",
  refuse: "Mark refused",
  cancel: "Cancel order",
  mark_returned: "Mark returned",
};

/** Statuses before handover: the 48 h timer runs and the order can still be cancelled. */
export const PRE_HANDOVER_STATUSES: readonly ShopOrderStatus[] = ["placed", "confirmed", "packed"];

export interface LifecycleConfig {
  /** Shop owner/staff may mark handed-over orders delivered or refused (no courier feed, D4). */
  shopMarksDelivery: boolean;
}

/** `SHOP_MARKS_DELIVERY=true|false`; defaults to on in test mode (pre-release checklist: courier). */
export function loadLifecycleConfig(env: Record<string, string | undefined> = process.env): LifecycleConfig {
  const flag = env.SHOP_MARKS_DELIVERY?.trim().toLowerCase();
  const testMode = env.APP_MODE === "test";
  return { shopMarksDelivery: flag === "true" || flag === "1" ? true : flag === "false" || flag === "0" ? false : testMode };
}

export interface TransitionInput {
  reason?: unknown;
  courierName?: unknown;
  trackingNo?: unknown;
  /** mark_returned from delivered only: put the items back into stock (returns feature decides). */
  restock?: unknown;
}

/** Columns written on shop_order with the new status. */
export interface ShopOrderPatch {
  status: ShopOrderStatus;
  statusChangedAt: Date;
  confirmedAt?: Date;
  packedAt?: Date;
  handedOverAt?: Date;
  courierName?: string;
  trackingNo?: string;
  deliveredAt?: Date;
  refusedAt?: Date;
  refusalNote?: string | null;
  cancelledAt?: Date;
  cancelledBy?: "shop" | "customer" | "admin";
  cancelReason?: string;
  returnedAt?: Date;
  restockedAt?: Date;
}

export interface TransitionPlan {
  action: LifecycleAction;
  from: ShopOrderStatus;
  to: ShopOrderStatus;
  patch: ShopOrderPatch;
  /** Put every item's quantity back on its variant (same transaction). */
  restock: boolean;
  /** Event note: reason, refusal note or courier + tracking. */
  note: string | null;
}

const SHOP: readonly ActorRole[] = ["shop_owner", "shop_staff"];
const isShop = (actor: ActorRole) => SHOP.includes(actor);

/** The status each action leads to, and the statuses it starts from. */
const RULES: Record<LifecycleAction, { from: readonly ShopOrderStatus[]; to: ShopOrderStatus }> = {
  confirm: { from: ["placed"], to: "confirmed" },
  pack: { from: ["confirmed"], to: "packed" },
  hand_over: { from: ["packed"], to: "handed_over" },
  deliver: { from: ["handed_over"], to: "delivered" },
  refuse: { from: ["handed_over"], to: "refused" },
  cancel: { from: PRE_HANDOVER_STATUSES, to: "cancelled" },
  mark_returned: { from: ["refused", "delivered"], to: "returned" },
};

/** Who may take `action` on a shop order in `status` (the status itself is checked separately). */
export function actorAllowed(action: LifecycleAction, status: ShopOrderStatus, actor: ActorRole, config: LifecycleConfig): boolean {
  if (actor === "admin") return true;
  switch (action) {
    case "confirm":
    case "pack":
    case "hand_over":
      return isShop(actor);
    case "deliver":
    case "refuse":
      return actor === "system" || (isShop(actor) && config.shopMarksDelivery);
    case "cancel":
      // Free cancellation until handover; the customer only before the shop confirmed.
      return isShop(actor) || (actor === "customer" && status === "placed");
    case "mark_returned":
      // A refused parcel back at the shop: the shop records it. A delivered order comes back
      // through the returns flow (system) or the admin.
      return status === "refused" ? isShop(actor) || actor === "system" : actor === "system";
  }
}

/** The actions `actor` can take now (for buttons). */
export function availableActions(status: ShopOrderStatus, actor: ActorRole, config: LifecycleConfig): LifecycleAction[] {
  return LIFECYCLE_ACTIONS.filter((a) => RULES[a].from.includes(status) && actorAllowed(a, status, actor, config));
}

function text(value: unknown, field: string, { min, max, label }: { min: number; max: number; label: string }): string {
  const v = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (v.length < min) throw new OrderError(422, "VALIDATION", `Enter ${label}`, { [field]: min > 1 ? `Enter ${label} (at least ${min} characters)` : `Enter ${label}` });
  if (v.length > max) throw new OrderError(422, "VALIDATION", `${label} is too long`, { [field]: `Use at most ${max} characters` });
  return v;
}

function optionalText(value: unknown, field: string, max: number): string | null {
  const v = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!v) return null;
  if (v.length > max) throw new OrderError(422, "VALIDATION", "The note is too long", { [field]: `Use at most ${max} characters` });
  return v;
}

const CUSTOMER_CANCEL_REASON = "Cancelled by the customer";

/**
 * Checks a transition and works out what to write. Throws OrderError: 409 INVALID_TRANSITION
 * (wrong status), 403 FORBIDDEN (this actor may not), 422 VALIDATION (missing reason, courier…).
 */
export function planTransition(args: {
  status: ShopOrderStatus;
  action: LifecycleAction;
  actor: ActorRole;
  input?: TransitionInput;
  now: Date;
  config: LifecycleConfig;
}): TransitionPlan {
  const { status, action, actor, now, config } = args;
  const input = args.input ?? {};
  const rule = RULES[action];
  if (!rule) throw new OrderError(422, "VALIDATION", "Unknown action", { action: `Use one of: ${LIFECYCLE_ACTIONS.join(", ")}` });
  if (!rule.from.includes(status)) {
    throw new OrderError(409, "INVALID_TRANSITION", invalidMessage(action, status));
  }
  if (!actorAllowed(action, status, actor, config)) {
    const message =
      actor === "customer" && action === "cancel"
        ? "The shop has already confirmed this order, so it can't be cancelled here. Contact the shop or raise a complaint."
        : (action === "deliver" || action === "refuse") && isShop(actor)
          ? "Delivery is recorded by the courier or the Platform Admin."
          : "You can't do this on this order.";
    throw new OrderError(403, "FORBIDDEN", message);
  }

  const patch: ShopOrderPatch = { status: rule.to, statusChangedAt: now };
  let restock = false;
  let note: string | null = null;
  switch (action) {
    case "confirm":
      patch.confirmedAt = now;
      break;
    case "pack":
      patch.packedAt = now;
      break;
    case "hand_over": {
      const courierName = text(input.courierName, "courierName", { min: 2, max: 80, label: "the courier's name" });
      const trackingNo = text(input.trackingNo, "trackingNo", { min: 3, max: 60, label: "the tracking number" });
      Object.assign(patch, { handedOverAt: now, courierName, trackingNo });
      note = `Courier: ${courierName}, tracking: ${trackingNo}`;
      break;
    }
    case "deliver":
      patch.deliveredAt = now;
      break;
    case "refuse":
      note = optionalText(input.reason, "reason", 500);
      Object.assign(patch, { refusedAt: now, refusalNote: note });
      break;
    case "cancel": {
      const reason =
        actor === "customer"
          ? (optionalText(input.reason, "reason", 500) ?? CUSTOMER_CANCEL_REASON)
          : text(input.reason, "reason", { min: 3, max: 500, label: "a reason" });
      Object.assign(patch, { cancelledAt: now, cancelledBy: actor === "customer" ? "customer" : actor === "admin" ? "admin" : "shop", cancelReason: reason });
      note = reason;
      restock = true;
      break;
    }
    case "mark_returned":
      patch.returnedAt = now;
      // Refused parcel back at the shop: always restocked. A customer return: as decided.
      restock = status === "refused" || input.restock === true || input.restock === "true";
      note = optionalText(input.reason, "reason", 500);
      break;
  }
  if (restock) patch.restockedAt = now;
  return { action, from: status, to: rule.to, patch, restock, note };
}

function invalidMessage(action: LifecycleAction, status: ShopOrderStatus): string {
  if (action === "cancel") {
    return status === "cancelled" ? "This order is already cancelled." : "This order has been handed over to the courier, so it can't be cancelled.";
  }
  return `You can't ${ACTION_LABELS[action].toLowerCase()} while the order is ${status.replace("_", " ")}.`;
}

/** Parses an action name from a request (422 when unknown). */
export function parseAction(value: unknown): LifecycleAction {
  if (typeof value === "string" && (LIFECYCLE_ACTIONS as readonly string[]).includes(value)) return value as LifecycleAction;
  throw new OrderError(422, "VALIDATION", "Unknown action", { action: `Use one of: ${LIFECYCLE_ACTIONS.join(", ")}` });
}

/** The actor role of a shop member. */
export const shopActor = (role: "owner" | "staff"): ActorRole => (role === "owner" ? "shop_owner" : "shop_staff");

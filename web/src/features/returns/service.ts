import { ReturnError } from "./errors";
import { storeReturnPhotos, type PhotoDeps, type PhotoFile } from "./photos";
import {
  assertCanDispute,
  assertCanRequest,
  isReturnEligibility,
  nextStatus,
  refundLimit,
  REFUND_METHODS,
  RETURN_REASONS,
  returnOptions,
  shopDueAt,
  splitRefund,
  type ExistingReturn,
  type RefundMethod,
  type ReturnAction,
  type ReturnEligibility,
  type ReturnOptions,
  type ReturnReason,
  type ReturnStatus,
} from "./rules";

/**
 * Returns service (US-070, US-071): the rules in ./rules applied to stored requests. Callers pass
 * a scope they have already checked (the guard-checked shopId, an order the customer may open, or
 * the admin), and the store only finds requests inside that scope (ADR-004). Every status change
 * is a conditional update from the allowed statuses, so two clicks never apply twice.
 */

export type ReturnScope = { kind: "order"; orderId: string } | { kind: "shop"; shopId: string } | { kind: "admin" };

export type ReturnEvent = "requested" | "accepted" | "rejected" | "escalated" | "approved" | "denied" | "received" | "refunded";

export interface ReturnRecord {
  id: string;
  orderId: string;
  orderNo: string;
  shopOrderId: string;
  orderItemId: string;
  shopId: string;
  userId: string | null;
  quantity: number;
  reason: ReturnReason;
  status: ReturnStatus;
  shopDueAt: Date;
  shopRespondedAt: Date | null;
  receivedAt: Date | null;
  restockedAt: Date | null;
  /** Item snapshot price (Tk) and variant (null when the seller removed it). */
  unitPrice: string;
  variantId: string | null;
  /** The shop order's delivery charge (Tk). */
  deliveryCharge: string;
}

export interface ItemForReturn {
  order: { id: string; orderNo: string; userId: string | null; contactPhone: string; policyVersions: unknown };
  shopOrder: { id: string; shopId: string; status: string; deliveredAt: Date | null };
  item: { id: string; title: string; quantity: number; returnEligibility: string | null; medicine: boolean };
  existing: ExistingReturn[];
}

export interface NewReturn {
  orderId: string;
  shopOrderId: string;
  orderItemId: string;
  shopId: string;
  userId: string | null;
  contactPhone: string;
  quantity: number;
  reason: ReturnReason;
  details: string | null;
  photoKeys: string[];
  policyVersion: number | null;
  shopDueAt: Date;
  createdAt: Date;
}

export interface ReturnEffects {
  /** Put the units back into the variant's stock (once: only when restockedAt was null). */
  restock?: { variantId: string; quantity: number };
  /** After a refund: mark the shop order returned when every unit of every item is refunded. */
  completeShopOrder?: boolean;
}

export interface ReturnsStore {
  itemForReturn(orderId: string, orderItemId: string): Promise<ItemForReturn | null>;
  /** Creates the request in a transaction that locks the item and re-runs `recheck` on fresh data. */
  create(data: NewReturn, recheck: (existing: ExistingReturn[]) => void): Promise<{ id: string }>;
  find(scope: ReturnScope, id: string): Promise<ReturnRecord | null>;
  /** Conditional update (only from `from`) with its side effects in one transaction; false when the status moved. */
  update(id: string, from: readonly ReturnStatus[], data: Record<string, unknown>, effects?: ReturnEffects): Promise<boolean>;
  deliveryAlreadyRefunded(shopOrderId: string, exceptId: string): Promise<boolean>;
  listOverdue(now: Date, take: number): Promise<{ id: string; shopDueAt: Date }[]>;
  audit(actorId: string | null, action: string, returnId: string, data?: Record<string, unknown>): Promise<void>;
}

export interface ReturnsServiceDeps {
  store: ReturnsStore;
  photos: PhotoDeps;
  now(): Date;
  /** Enqueues the notification job; a failure is logged, never fails the change. */
  notify(returnId: string, event: ReturnEvent): Promise<unknown>;
}

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

function requiredNote(v: unknown, field = "note"): string {
  const t = clean(v, 1000);
  if (!t || t.length < 5) throw new ReturnError(422, "VALIDATION", "Give a short reason", { [field]: "Write at least 5 characters" });
  return t;
}

function policyVersionOf(value: unknown): number | null {
  if (!Array.isArray(value)) return null;
  const entry = value.find((v) => typeof v === "object" && v !== null && (v as { slug?: unknown }).slug === "returns") as { version?: unknown } | undefined;
  return typeof entry?.version === "number" ? entry.version : null;
}

export const eligibilityOf = (v: string | null): ReturnEligibility | null => (isReturnEligibility(v) ? v : null);

export interface RequestInput {
  orderItemId: unknown;
  quantity: unknown;
  reason: unknown;
  details?: unknown;
  photos?: readonly PhotoFile[];
}

export interface RefundInput {
  method: unknown;
  reference: unknown;
  amount: unknown;
  restock?: unknown;
}

const truthy = (v: unknown) => v === true || v === "on" || v === "true";

export function createReturnsService(deps: ReturnsServiceDeps) {
  const { store } = deps;

  async function notify(id: string, event: ReturnEvent) {
    try {
      await deps.notify(id, event);
    } catch (err) {
      console.error("[returns] notification not queued", id, event, err);
    }
  }

  async function load(scope: ReturnScope, id: string): Promise<ReturnRecord> {
    const r = await store.find(scope, id);
    if (!r) throw new ReturnError(404, "NOT_FOUND", "Return request not found");
    return r;
  }

  /** Applies an action: checks the transition, writes it conditionally, audits and notifies. */
  async function move(
    r: ReturnRecord,
    action: ReturnAction,
    data: Record<string, unknown>,
    opts: { actorId: string | null; event?: ReturnEvent; effects?: ReturnEffects; from?: readonly ReturnStatus[] } = { actorId: null },
  ) {
    const to = nextStatus(r.status, action);
    const now = deps.now();
    const ok = await store.update(r.id, opts.from ?? [r.status], { ...data, status: to, statusChangedAt: now }, opts.effects);
    if (!ok) throw new ReturnError(409, "RETURN_STATE", "This return was changed by someone else. Reload the page.");
    await store.audit(opts.actorId, `return.${action}`, r.id, { from: r.status, to });
    if (opts.event) await notify(r.id, opts.event);
    return to;
  }

  return {
    /** What the customer may ask for this item now (the request form). Null when not found in the order. */
    async options(orderId: string, orderItemId: string): Promise<(ReturnOptions & { item: ItemForReturn["item"] }) | null> {
      const facts = await store.itemForReturn(orderId, orderItemId);
      if (!facts) return null;
      const item = { quantity: facts.item.quantity, returnEligibility: eligibilityOf(facts.item.returnEligibility), medicine: facts.item.medicine };
      return { ...returnOptions(facts.shopOrder, item, facts.existing, deps.now()), item: facts.item };
    },

    /** US-070: the customer (account or guest with access to `orderId`) asks for a return. */
    async request(orderId: string, actorUserId: string | null, input: RequestInput): Promise<{ id: string; warning: string | null }> {
      if (typeof input.orderItemId !== "string" || !input.orderItemId) {
        throw new ReturnError(422, "VALIDATION", "Choose the item to return", { orderItemId: "Choose an item" });
      }
      const reason = input.reason as ReturnReason;
      if (!RETURN_REASONS.includes(reason)) throw new ReturnError(422, "VALIDATION", "Choose a reason", { reason: "Choose a reason" });
      const quantity = Number(input.quantity);
      const details = clean(input.details, 1000);

      const facts = await store.itemForReturn(orderId, input.orderItemId);
      if (!facts) throw new ReturnError(404, "NOT_FOUND", "Item not found in this order");
      const item = { quantity: facts.item.quantity, returnEligibility: eligibilityOf(facts.item.returnEligibility), medicine: facts.item.medicine };
      const now = deps.now();
      const ask = { quantity, reason, details };
      assertCanRequest(facts.shopOrder, item, facts.existing, ask, now);

      const photos = await storeReturnPhotos(input.photos ?? [], reason, deps.photos);
      const { id } = await store.create(
        {
          orderId: facts.order.id,
          shopOrderId: facts.shopOrder.id,
          orderItemId: facts.item.id,
          shopId: facts.shopOrder.shopId,
          userId: actorUserId,
          contactPhone: facts.order.contactPhone,
          quantity,
          reason,
          details,
          photoKeys: photos.keys,
          policyVersion: policyVersionOf(facts.order.policyVersions),
          shopDueAt: shopDueAt(now),
          createdAt: now,
        },
        (existing) => assertCanRequest(facts.shopOrder, item, existing, ask, now),
      );
      await store.audit(actorUserId, "return.requested", id, { orderItemId: facts.item.id, quantity, reason });
      await notify(id, "requested");
      return { id, warning: photos.warning };
    },

    /** The customer withdraws a request the shop has not answered. */
    async cancel(scope: ReturnScope, actorId: string | null, id: string) {
      const r = await load(scope, id);
      await move(r, "cancel", { closedAt: deps.now() }, { actorId });
    },

    /** The customer sends a rejected request to the admin (dispute). */
    async dispute(scope: ReturnScope, actorId: string | null, id: string, note: unknown) {
      const r = await load(scope, id);
      assertCanDispute(r, deps.now());
      await move(r, "dispute", { escalatedAt: deps.now(), escalationReason: "customer_dispute", disputeNote: requiredNote(note) }, { actorId, event: "escalated" });
    },

    /** US-071: the shop accepts (within 48 h). */
    async accept(shopId: string, actorId: string, id: string, note?: unknown) {
      const r = await load({ kind: "shop", shopId }, id);
      await move(r, "accept", { shopRespondedAt: deps.now(), shopNote: clean(note, 1000) }, { actorId, event: "accepted" });
    },

    /** US-071: the shop rejects with a reason; the customer can send it to the admin. */
    async reject(shopId: string, actorId: string, id: string, note: unknown) {
      const r = await load({ kind: "shop", shopId }, id);
      await move(r, "reject", { shopRespondedAt: deps.now(), shopNote: requiredNote(note) }, { actorId, event: "rejected" });
    },

    /** The admin decides an escalated request (dispute or no answer from the shop). */
    async decide(actorId: string, id: string, decision: "approve" | "deny", note: unknown) {
      const r = await load({ kind: "admin" }, id);
      const adminNote = decision === "deny" ? requiredNote(note) : clean(note, 1000);
      const extra = decision === "deny" ? { closedAt: deps.now() } : {};
      await move(r, decision, { adminDecidedAt: deps.now(), adminDecidedById: actorId, adminNote, ...extra }, { actorId, event: decision === "approve" ? "approved" : "denied" });
    },

    /** The item is back with the shop and inspected; the units go back into stock when `restock`. */
    async receive(scope: ReturnScope, actorId: string, id: string, restock: unknown) {
      if (scope.kind === "order") throw new ReturnError(403, "FORBIDDEN", "Not allowed");
      const r = await load(scope, id);
      const back = truthy(restock) && r.variantId && !r.restockedAt;
      const now = deps.now();
      await move(r, "receive", { receivedAt: now, ...(back ? { restockedAt: now } : {}) }, {
        actorId,
        event: "received",
        effects: back ? { restock: { variantId: r.variantId!, quantity: r.quantity } } : undefined,
      });
    },

    /**
     * US-071: the refund was paid by hand (R1); the shop (or the admin, who holds COD money in
     * production) records method, reference and amount. The customer is notified. A return not yet
     * marked received is marked now. The shop order becomes "returned" when everything is refunded.
     */
    async refund(scope: ReturnScope, actorId: string, id: string, input: RefundInput) {
      if (scope.kind === "order") throw new ReturnError(403, "FORBIDDEN", "Not allowed");
      const r = await load(scope, id);
      nextStatus(r.status, "refund");
      const method = input.method as RefundMethod;
      if (!REFUND_METHODS.includes(method)) throw new ReturnError(422, "VALIDATION", "Choose how the refund was paid", { method: "Choose a method" });
      const reference = clean(input.reference, 100);
      if (!reference || reference.length < 3) {
        throw new ReturnError(422, "VALIDATION", "Enter the payment reference", { reference: "Enter the transaction ID, receipt or note (at least 3 characters)" });
      }
      const limit = refundLimit({
        unitPrice: r.unitPrice,
        quantity: r.quantity,
        reason: r.reason,
        deliveryCharge: r.deliveryCharge,
        deliveryAlreadyRefunded: await store.deliveryAlreadyRefunded(r.shopOrderId, r.id),
      });
      const money = splitRefund(Number(input.amount), limit);
      const now = deps.now();
      const back = !r.receivedAt && truthy(input.restock) && r.variantId && !r.restockedAt;
      await move(
        r,
        "refund",
        {
          refundAmount: money.amount,
          refundDelivery: money.delivery,
          refundMethod: method,
          refundReference: reference,
          refundedAt: now,
          refundedById: actorId,
          closedAt: now,
          ...(r.receivedAt ? {} : { receivedAt: now }),
          ...(back ? { restockedAt: now } : {}),
        },
        { actorId, event: "refunded", effects: { completeShopOrder: true, ...(back ? { restock: { variantId: r.variantId!, quantity: r.quantity } } : {}) } },
      );
      return money;
    },

    /** The returns.escalate-overdue job: requests the shop left unanswered for 48 h go to the admin. */
    async escalateOverdue(take = 200): Promise<{ escalated: string[] }> {
      const now = deps.now();
      const escalated: string[] = [];
      for (const r of await store.listOverdue(now, take)) {
        if (r.shopDueAt.getTime() > now.getTime()) continue;
        const ok = await store.update(r.id, ["requested"], { status: "escalated", statusChangedAt: now, escalatedAt: now, escalationReason: "no_response" });
        if (!ok) continue; // answered meanwhile
        await store.audit(null, "return.escalate", r.id, { reason: "no_response" });
        await notify(r.id, "escalated");
        escalated.push(r.id);
      }
      return { escalated };
    },
  };
}

export type ReturnsService = ReturnType<typeof createReturnsService>;

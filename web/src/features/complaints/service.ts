import {
  adminTransition,
  assertCanReply,
  complaintDueAt,
  ComplaintError,
  parseMessage,
  parseOpenInput,
  parseResolution,
  statusAfterReply,
  type AdminAction,
  type AuthorRole,
  type ComplaintCategory,
  type ComplaintStatus,
} from "./rules";

/**
 * Complaints service (US-072). Callers pass a scope they already checked: an order the customer
 * may open, the guard-checked shopId, or the admin; the store finds tickets only inside it.
 * Status changes are conditional updates, so a double click never applies twice.
 */

export type ComplaintScope = { kind: "order"; orderId: string } | { kind: "shop"; shopId: string } | { kind: "admin" };
export type ComplaintEvent = "opened" | "reply" | "in_progress" | "resolved" | "closed" | "overdue";

export interface TicketRecord {
  id: string;
  ticketNo: string;
  status: ComplaintStatus;
  dueAt: Date;
  shopId: string | null;
}

export interface OrderForComplaint {
  id: string;
  orderNo: string;
  contactPhone: string;
  contactEmail: string | null;
  /** The order's account email (when the order belongs to one). */
  accountEmail: string | null;
  shopOrders: { id: string; shopId: string }[];
}

export interface NewTicket {
  ticketNo: string;
  userId: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  orderId: string;
  shopOrderId: string | null;
  shopId: string | null;
  subject: string;
  category: ComplaintCategory;
  dueAt: Date;
  createdAt: Date;
}

export interface ComplaintsStore {
  orderForComplaint(orderId: string): Promise<OrderForComplaint | null>;
  create(ticket: NewTicket, firstMessage: { authorId: string | null; text: string }): Promise<{ id: string; ticketNo: string }>;
  find(scope: ComplaintScope, id: string): Promise<TicketRecord | null>;
  /** Adds a message; with `move`, also changes the status (only from `move.from`). Returns the message id. */
  addMessage(id: string, msg: { authorRole: AuthorRole; authorId: string | null; text: string; at: Date }, move?: { from: ComplaintStatus; to: ComplaintStatus }): Promise<string>;
  /** Conditional update; false when the status moved meanwhile. */
  update(id: string, from: readonly ComplaintStatus[], data: Record<string, unknown>): Promise<boolean>;
  listOverdue(now: Date, take: number): Promise<{ id: string }[]>;
  /** Sets overdue_at once (only while null and still active); false when already flagged or closed. */
  flagOverdue(id: string, now: Date): Promise<boolean>;
  audit(actorId: string | null, action: string, ticketId: string, data?: Record<string, unknown>): Promise<void>;
}

export interface ComplaintsServiceDeps {
  store: ComplaintsStore;
  now(): Date;
  newTicketNo(now: Date): string;
  notify(ticketId: string, event: ComplaintEvent, messageId?: string): Promise<unknown>;
}

export function createComplaintsService(deps: ComplaintsServiceDeps) {
  const { store } = deps;

  async function notify(id: string, event: ComplaintEvent, messageId?: string) {
    try {
      await deps.notify(id, event, messageId);
    } catch (err) {
      console.error("[complaints] notification not queued", id, event, err);
    }
  }

  async function load(scope: ComplaintScope, id: string) {
    const t = await store.find(scope, id);
    if (!t) throw new ComplaintError(404, "NOT_FOUND", "Complaint not found");
    return t;
  }

  return {
    /** A customer with access to the order opens a ticket (about one of its shop orders when given). */
    async open(orderId: string, actorUserId: string | null, body: { shopOrderId?: unknown; subject?: unknown; category?: unknown; message?: unknown }) {
      const input = parseOpenInput(body);
      const order = await store.orderForComplaint(orderId);
      if (!order) throw new ComplaintError(404, "NOT_FOUND", "Order not found");
      let shopOrder: { id: string; shopId: string } | null = null;
      if (typeof body.shopOrderId === "string" && body.shopOrderId) {
        shopOrder = order.shopOrders.find((s) => s.id === body.shopOrderId) ?? null;
        if (!shopOrder) throw new ComplaintError(422, "VALIDATION", "Choose a shop order of this order", { shopOrderId: "Choose a shop order of this order" });
      } else if (order.shopOrders.length === 1) {
        shopOrder = order.shopOrders[0];
      }
      const now = deps.now();
      const ticket = await store.create(
        {
          ticketNo: deps.newTicketNo(now),
          userId: actorUserId,
          contactPhone: order.contactPhone,
          contactEmail: order.contactEmail ?? order.accountEmail,
          orderId: order.id,
          shopOrderId: shopOrder?.id ?? null,
          shopId: shopOrder?.shopId ?? null,
          subject: input.subject,
          category: input.category,
          dueAt: complaintDueAt(now),
          createdAt: now,
        },
        { authorId: actorUserId, text: input.message },
      );
      await store.audit(actorUserId, "complaint.opened", ticket.id, { orderId, shopOrderId: shopOrder?.id ?? null });
      await notify(ticket.id, "opened");
      return ticket;
    },

    /** A message in the thread: the customer (order scope), the shop (its tickets) or the admin. */
    async reply(scope: ComplaintScope, author: { role: AuthorRole; id: string | null }, id: string, textInput: unknown) {
      const roleOk = (scope.kind === "order" && author.role === "customer") || (scope.kind === "shop" && author.role === "shop") || (scope.kind === "admin" && author.role === "admin");
      if (!roleOk) throw new ComplaintError(403, "FORBIDDEN", "Not allowed");
      const text = parseMessage(textInput);
      const t = await load(scope, id);
      assertCanReply(t.status);
      const to = statusAfterReply(t.status, author.role);
      const now = deps.now();
      const messageId = await store.addMessage(t.id, { authorRole: author.role, authorId: author.id, text, at: now }, to !== t.status ? { from: t.status, to } : undefined);
      if (to !== t.status) await store.audit(author.id, "complaint.in_progress", t.id, { by: author.role });
      await notify(t.id, "reply", messageId);
      return { messageId, status: to };
    },

    /** The admin starts, resolves or closes a ticket (resolve and close need the resolution note). */
    async adminUpdate(actorId: string, id: string, action: AdminAction, resolutionInput?: unknown) {
      const t = await load({ kind: "admin" }, id);
      const to = adminTransition(t.status, action);
      const now = deps.now();
      const data: Record<string, unknown> = { status: to, statusChangedAt: now };
      if (to === "resolved" || to === "closed") Object.assign(data, { resolution: parseResolution(resolutionInput), resolvedAt: now, resolvedById: actorId });
      const ok = await store.update(t.id, [t.status], data);
      if (!ok) throw new ComplaintError(409, "COMPLAINT_STATE", "This complaint was changed by someone else. Reload the page.");
      await store.audit(actorId, `complaint.${to}`, t.id, { from: t.status });
      await notify(t.id, to as ComplaintEvent);
      return { status: to };
    },

    /** The complaints.flag-overdue job: each ticket past its 72 h is flagged once and the admin alerted. */
    async flagOverdue(take = 200): Promise<{ flagged: string[] }> {
      const now = deps.now();
      const flagged: string[] = [];
      for (const t of await store.listOverdue(now, take)) {
        if (!(await store.flagOverdue(t.id, now))) continue;
        await store.audit(null, "complaint.overdue", t.id);
        await notify(t.id, "overdue");
        flagged.push(t.id);
      }
      return { flagged };
    },
  };
}

export type ComplaintsService = ReturnType<typeof createComplaintsService>;

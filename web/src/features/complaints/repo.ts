import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ACTIVE_COMPLAINT_STATUSES, ComplaintError, isActive, type AuthorRole, type ComplaintStatus } from "./rules";
import type { ComplaintScope, NewTicket, OrderForComplaint, TicketRecord } from "./service";

/**
 * Complaints data access (ADR-004): every read takes its scope first (an order the customer may
 * open, the user's own orders, a guard-checked shopId, or the admin). Tickets and messages are
 * 6-year records: never deleted, closed with a status.
 */

export function scopeWhere(scope: ComplaintScope): Prisma.ComplaintTicketWhereInput {
  if (scope.kind === "order") return { orderId: scope.orderId };
  if (scope.kind === "shop") return { shopId: scope.shopId };
  return {};
}

// ---------- ComplaintsStore ----------

export async function orderForComplaint(orderId: string): Promise<OrderForComplaint | null> {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNo: true, contactPhone: true, contactEmail: true, user: { select: { email: true } }, shopOrders: { select: { id: true, shopId: true }, orderBy: { seq: "asc" } } },
  });
  if (!o) return null;
  return { id: o.id, orderNo: o.orderNo, contactPhone: o.contactPhone, contactEmail: o.contactEmail, accountEmail: o.user?.email ?? null, shopOrders: o.shopOrders };
}

export async function create(ticket: NewTicket, first: { authorId: string | null; text: string }) {
  return prisma.complaintTicket.create({
    data: {
      ...ticket,
      statusChangedAt: ticket.createdAt,
      messages: { create: { authorRole: "customer", authorId: first.authorId, text: first.text, createdAt: ticket.createdAt } },
    },
    select: { id: true, ticketNo: true },
  });
}

export function find(scope: ComplaintScope, id: string): Promise<TicketRecord | null> {
  return prisma.complaintTicket.findFirst({ where: { id, ...scopeWhere(scope) }, select: { id: true, ticketNo: true, status: true, dueAt: true, shopId: true } });
}

export async function addMessage(
  id: string,
  msg: { authorRole: AuthorRole; authorId: string | null; text: string; at: Date },
  move?: { from: ComplaintStatus; to: ComplaintStatus },
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    if (move) {
      const { count } = await tx.complaintTicket.updateMany({ where: { id, status: move.from }, data: { status: move.to, statusChangedAt: msg.at } });
      if (count !== 1) {
        // Someone else changed it first: fine if it is still active (e.g. already in progress).
        const now = await tx.complaintTicket.findUnique({ where: { id }, select: { status: true } });
        if (!now || !isActive(now.status)) throw new ComplaintError(409, "COMPLAINT_CLOSED", "This complaint is closed. Open a new one if the problem is back.");
      }
    }
    const m = await tx.complaintMessage.create({
      data: { ticketId: id, authorRole: msg.authorRole, authorId: msg.authorId, text: msg.text, createdAt: msg.at },
      select: { id: true },
    });
    await tx.complaintTicket.update({ where: { id }, data: { updatedAt: msg.at } });
    return m.id;
  });
}

export async function update(id: string, from: readonly ComplaintStatus[], data: Record<string, unknown>): Promise<boolean> {
  const { count } = await prisma.complaintTicket.updateMany({ where: { id, status: { in: [...from] } }, data: data as Prisma.ComplaintTicketUpdateManyMutationInput });
  return count === 1;
}

export function listOverdue(now: Date, take: number) {
  return prisma.complaintTicket.findMany({
    where: { status: { in: [...ACTIVE_COMPLAINT_STATUSES] }, dueAt: { lte: now }, overdueAt: null },
    select: { id: true },
    orderBy: { dueAt: "asc" },
    take,
  });
}

export async function flagOverdue(id: string, now: Date): Promise<boolean> {
  const { count } = await prisma.complaintTicket.updateMany({
    where: { id, overdueAt: null, status: { in: [...ACTIVE_COMPLAINT_STATUSES] }, dueAt: { lte: now } },
    data: { overdueAt: now },
  });
  return count === 1;
}

export async function audit(actorId: string | null, action: string, ticketId: string, data?: Record<string, unknown>) {
  await prisma.auditLog.create({ data: { actorId, action, entity: "complaint_ticket", entityId: ticketId, data: data as Prisma.InputJsonValue } });
}

// ---------- Lists and details ----------

export const listSelect = {
  id: true,
  ticketNo: true,
  subject: true,
  category: true,
  status: true,
  statusChangedAt: true,
  dueAt: true,
  overdueAt: true,
  resolvedAt: true,
  resolution: true,
  createdAt: true,
  updatedAt: true,
  shopId: true,
  order: { select: { orderNo: true, contactName: true } },
  shopOrder: { select: { id: true, seq: true, shopName: true } },
  _count: { select: { messages: true } },
} satisfies Prisma.ComplaintTicketSelect;

export type TicketRow = Prisma.ComplaintTicketGetPayload<{ select: typeof listSelect }>;

export const detailSelect = {
  ...listSelect,
  messages: { select: { id: true, authorRole: true, text: true, createdAt: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.ComplaintTicketSelect;

export type TicketDetailRow = Prisma.ComplaintTicketGetPayload<{ select: typeof detailSelect }>;

/** The user's tickets: opened from the account, or on orders that belong to it. Newest first. */
export function listForUser(userId: string, take = 100): Promise<TicketRow[]> {
  return prisma.complaintTicket.findMany({ where: { OR: [{ userId }, { order: { userId } }] }, select: listSelect, orderBy: { createdAt: "desc" }, take });
}

/** Tickets on one order (the caller checked the customer may open it). */
export function listForOrder(orderId: string): Promise<TicketRow[]> {
  return prisma.complaintTicket.findMany({ where: { orderId }, select: listSelect, orderBy: { createdAt: "desc" } });
}

/** The shop's tickets (about its shop orders), active first by due time. Only rows of `shopId`. */
export function listForShop(shopId: string, take = 200): Promise<TicketRow[]> {
  return prisma.complaintTicket.findMany({ where: { shopId }, select: listSelect, orderBy: [{ resolvedAt: { sort: "desc", nulls: "first" } }, { dueAt: "asc" }], take });
}

/** Admin queue: active tickets by due time (overdue first), or the given statuses. */
export function listForAdmin(opts: { statuses?: readonly ComplaintStatus[]; take?: number } = {}): Promise<TicketRow[]> {
  return prisma.complaintTicket.findMany({
    where: { status: { in: [...(opts.statuses ?? ACTIVE_COMPLAINT_STATUSES)] } },
    select: listSelect,
    orderBy: [{ dueAt: "asc" }],
    take: opts.take ?? 200,
  });
}

export function getDetail(scope: ComplaintScope, id: string): Promise<TicketDetailRow | null> {
  return prisma.complaintTicket.findFirst({ where: { id, ...scopeWhere(scope) }, select: detailSelect });
}

/** The order a ticket belongs to (customer access is then checked through the order). */
export async function orderNoOf(id: string): Promise<string | null> {
  const t = await prisma.complaintTicket.findUnique({ where: { id }, select: { order: { select: { orderNo: true } } } });
  return t?.order?.orderNo ?? null;
}

// ---------- Figures for metrics (US-083) and the seller score (US-059) ----------

export interface ComplaintStats {
  opened: number;
  /** Resolved or closed tickets opened in the period. */
  closed: number;
  /** Of those, closed by their 72 h due time (target 95%). */
  closedOnTime: number;
  closedOnTimeRate: number;
  /** Median and average hours from opening to resolution (closed tickets only; null when none). */
  medianHoursToResolve: number | null;
  averageHoursToResolve: number | null;
  /** Still open now and past due. */
  overdueNow: number;
}

/** Complaint resolution times for the marketplace (metrics) or one shop (seller score). */
export async function complaintStats(opts: { shopId?: string; from: Date; to: Date; now?: Date }): Promise<ComplaintStats> {
  const shop = opts.shopId ? { shopId: opts.shopId } : {};
  const now = opts.now ?? new Date();
  const [tickets, overdueNow] = await Promise.all([
    prisma.complaintTicket.findMany({ where: { ...shop, createdAt: { gte: opts.from, lt: opts.to } }, select: { createdAt: true, dueAt: true, resolvedAt: true } }),
    prisma.complaintTicket.count({ where: { ...shop, status: { in: [...ACTIVE_COMPLAINT_STATUSES] }, dueAt: { lte: now } } }),
  ]);
  const closed = tickets.filter((t) => t.resolvedAt);
  const hours = closed.map((t) => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 3_600_000).sort((a, b) => a - b);
  const onTime = closed.filter((t) => t.resolvedAt! <= t.dueAt).length;
  const median = hours.length ? (hours.length % 2 ? hours[(hours.length - 1) / 2] : (hours[hours.length / 2 - 1] + hours[hours.length / 2]) / 2) : null;
  return {
    opened: tickets.length,
    closed: closed.length,
    closedOnTime: onTime,
    closedOnTimeRate: closed.length ? onTime / closed.length : 1,
    medianHoursToResolve: median,
    averageHoursToResolve: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null,
    overdueNow,
  };
}

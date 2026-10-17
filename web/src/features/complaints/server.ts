import { generateOrderNo, formatDhakaTime } from "@/features/orders";
import { viewableOrder } from "@/features/orders/server";
import { requirePlatformAdmin, requireShopRole, requireUser, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendJob } from "@/lib/jobs/boss";
import { appUrl, sendMail } from "@/lib/mail";
import { createSmsProvider } from "@/lib/sms";
import { createComplaintsApi } from "./api";
import { sendComplaintNotification } from "./notify";
import * as repo from "./repo";
import { COMPLAINT_STATUS_LABELS, type ComplaintStatus } from "./rules";
import { createComplaintsService, type ComplaintEvent, type ComplaintScope } from "./service";
import { sortForQueue, toTicketView, type TicketView } from "./views";

/** The complaints feature wired to Prisma, the session, the order grant, jobs, SMS and email. */

export const complaintsService = createComplaintsService({
  store: repo,
  now: () => new Date(),
  // CP-YYMMDD-XXXXX: the same readable alphabet as order numbers.
  newTicketNo: (now) => generateOrderNo(now).replace(/^BD-/, "CP-"),
  notify: (ticketId, event, messageId) =>
    sendJob("complaints.notify", { ticketId, event, ...(messageId ? { messageId } : {}) }, { retryLimit: 5, retryDelay: 60, retryBackoff: true }),
});

/** The logged-in user's id, or null for a guest. */
export async function currentUserId(): Promise<string | null> {
  try {
    return (await requireUser()).id;
  } catch (err) {
    if (err instanceof UnauthorizedError) return null;
    throw err;
  }
}

/** The order this request may open (own order or guest grant). */
export async function customerOrder(orderNo: string): Promise<{ id: string; orderNo: string } | null> {
  const order = await viewableOrder(orderNo);
  return order ? { id: order.id, orderNo: order.orderNo } : null;
}

export const complaintsApi = createComplaintsApi({
  currentUserId,
  customerOrder,
  async requireShop(shopId) {
    const access = await requireShopRole(shopId, ["owner", "staff"]);
    return { shopId: access.shopId, userId: access.user.id };
  },
  requireAdmin: () => requirePlatformAdmin(),
  service: complaintsService,
  rows: {
    forUser: (userId) => repo.listForUser(userId),
    forOrder: (orderId) => repo.listForOrder(orderId),
    forShop: (shopId) => repo.listForShop(shopId),
    forAdmin: (statuses) => repo.listForAdmin({ statuses }),
    detail: repo.getDetail,
    orderNoOf: repo.orderNoOf,
  },
  now: () => new Date(),
});

// ---------- Pages ----------

const views = (rows: repo.TicketRow[]) => rows.map((r) => toTicketView(r, new Date()));

export const complaintsOfUser = async (userId: string) => views(await repo.listForUser(userId));
export const complaintsOfOrder = async (orderId: string) => views(await repo.listForOrder(orderId));
/** Seller page: pass the guard-checked shopId. */
export const complaintsOfShop = async (shopId: string) => views(await repo.listForShop(shopId));
/** Admin queue (call requirePlatformAdmin() first): active tickets, overdue first, by due time. */
export const complaintQueue = async (statuses?: readonly ComplaintStatus[]) => sortForQueue(views(await repo.listForAdmin({ statuses })));

export async function complaintDetail(scope: ComplaintScope, id: string): Promise<TicketView | null> {
  const row = await repo.getDetail(scope, id);
  return row ? toTicketView(row, new Date()) : null;
}

/** For the customer's ticket page: the ticket if this browser may open its order (own or grant). */
export async function customerComplaint(id: string): Promise<{ ticket: TicketView; scope: ComplaintScope } | null> {
  const orderNo = await repo.orderNoOf(id);
  const order = orderNo ? await customerOrder(orderNo) : null;
  if (!order) return null;
  const scope: ComplaintScope = { kind: "order", orderId: order.id };
  const ticket = await complaintDetail(scope, id);
  return ticket ? { ticket, scope } : null;
}

// ---------- Worker ----------

/** The complaints.flag-overdue job. */
export const flagOverdueComplaints = () => complaintsService.flagOverdue();

/** The complaints.notify job. */
export function notifyComplaint(ticketId: string, event: ComplaintEvent, messageId?: string) {
  const sms = createSmsProvider();
  return sendComplaintNotification(ticketId, event, messageId, {
    async load(id, msgId) {
      const t = await prisma.complaintTicket.findUnique({
        where: { id },
        select: {
          id: true,
          ticketNo: true,
          subject: true,
          status: true,
          dueAt: true,
          resolution: true,
          shopId: true,
          contactPhone: true,
          contactEmail: true,
          order: { select: { orderNo: true, contactName: true } },
          user: { select: { name: true } },
          shop: { select: { members: { select: { user: { select: { email: true } } } } } },
        },
      });
      if (!t) return null;
      const [admins, message] = await Promise.all([
        prisma.user.findMany({ where: { isPlatformAdmin: true, status: "active", email: { not: null } }, select: { email: true } }),
        msgId ? prisma.complaintMessage.findFirst({ where: { id: msgId, ticketId: id }, select: { authorRole: true, text: true } }) : null,
      ]);
      const emails = (list: { email: string | null }[]) => [...new Set(list.map((u) => u.email).filter((e): e is string => !!e))];
      return {
        ticketNo: t.ticketNo,
        subject: t.subject,
        statusLabel: COMPLAINT_STATUS_LABELS[t.status],
        dueAtText: formatDhakaTime(t.dueAt.toISOString()),
        resolution: t.resolution,
        orderNo: t.order?.orderNo ?? null,
        customer: { name: t.order?.contactName ?? t.user?.name ?? "customer", phone: t.contactPhone, email: t.contactEmail },
        shopEmails: emails(t.shop?.members.map((m) => m.user) ?? []),
        adminEmails: emails(admins),
        message,
        customerUrl: appUrl(`/complaints/${t.id}`),
        sellerUrl: t.shopId ? appUrl(`/seller/${t.shopId}/complaints/${t.id}`) : null,
        adminUrl: appUrl(`/admin/complaints/${t.id}`),
      };
    },
    sendSms: (phone, text) => sms.send(phone, text),
    sendMail,
  });
}

// ---------- Figures for other features ----------

/** Metrics (US-083) and seller score (US-059): opened, resolved within 72 h, median/average hours, overdue now. */
export const complaintStats = repo.complaintStats;

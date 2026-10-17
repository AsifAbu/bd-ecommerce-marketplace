import {
  CATEGORY_LABELS,
  COMPLAINT_STATUS_LABELS,
  hoursLeft,
  isActive,
  isOverdue,
  type AuthorRole,
  type ComplaintCategory,
  type ComplaintStatus,
} from "./rules";

/** Plain views of stored tickets for pages and the JSON API. Pure. */

export interface TicketRowLike {
  id: string;
  ticketNo: string;
  subject: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  statusChangedAt: Date;
  dueAt: Date;
  overdueAt: Date | null;
  resolvedAt: Date | null;
  resolution: string | null;
  createdAt: Date;
  updatedAt: Date;
  shopId: string | null;
  order: { orderNo: string; contactName: string } | null;
  shopOrder: { id: string; seq: number; shopName: string } | null;
  _count?: { messages: number };
  messages?: { id: string; authorRole: AuthorRole; text: string; createdAt: Date }[];
}

export interface TicketView {
  id: string;
  ticketNo: string;
  subject: string;
  category: ComplaintCategory;
  categoryLabel: string;
  status: ComplaintStatus;
  statusLabel: string;
  active: boolean;
  createdAt: string;
  dueAt: string;
  /** Past its 72 h and still active. */
  overdue: boolean;
  /** Hours left (negative when overdue); null once resolved or closed. */
  hoursLeft: number | null;
  resolvedAt: string | null;
  resolvedOnTime: boolean | null;
  resolution: string | null;
  orderNo: string | null;
  customerName: string | null;
  shopOrderNo: string | null;
  shopName: string | null;
  messageCount: number;
  messages: { id: string; authorRole: AuthorRole; authorLabel: string; text: string; createdAt: string }[];
}

const AUTHOR_LABELS: Record<AuthorRole, string> = { customer: "Customer", shop: "Shop", admin: "Marketplace admin" };

export function toTicketView(t: TicketRowLike, now: Date): TicketView {
  return {
    id: t.id,
    ticketNo: t.ticketNo,
    subject: t.subject,
    category: t.category,
    categoryLabel: CATEGORY_LABELS[t.category],
    status: t.status,
    statusLabel: COMPLAINT_STATUS_LABELS[t.status],
    active: isActive(t.status),
    createdAt: t.createdAt.toISOString(),
    dueAt: t.dueAt.toISOString(),
    overdue: isOverdue(t, now),
    hoursLeft: isActive(t.status) ? hoursLeft(t.dueAt, now) : null,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    resolvedOnTime: t.resolvedAt ? t.resolvedAt.getTime() <= t.dueAt.getTime() : null,
    resolution: t.resolution,
    orderNo: t.order?.orderNo ?? null,
    customerName: t.order?.contactName ?? null,
    shopOrderNo: t.order && t.shopOrder ? `${t.order.orderNo}-${t.shopOrder.seq}` : null,
    shopName: t.shopOrder?.shopName ?? null,
    messageCount: t._count?.messages ?? t.messages?.length ?? 0,
    messages: (t.messages ?? []).map((m) => ({ id: m.id, authorRole: m.authorRole, authorLabel: AUTHOR_LABELS[m.authorRole], text: m.text, createdAt: m.createdAt.toISOString() })),
  };
}

/** Admin queue order: overdue first, then by due time; resolved and closed last. */
export function sortForQueue(tickets: TicketView[]): TicketView[] {
  return [...tickets].sort((a, b) => Number(b.active) - Number(a.active) || Number(b.overdue) - Number(a.overdue) || a.dueAt.localeCompare(b.dueAt));
}

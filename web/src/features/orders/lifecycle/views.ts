import { STATUS_LABELS, type ShopOrderStatus } from "../config";
import { OrderError } from "../errors";
import { shopOrderNo } from "../order-no";
import { localPhone, toAddress } from "../views";
import type { AddressSnapshot } from "../draft";
import { handoverCountdown, isOverdue, type Countdown } from "./handover";
import { availableActions, type ActorRole, type LifecycleAction, type LifecycleConfig } from "./machine";
import { buildTimeline, type TimelineEntry } from "./timeline";

/** View models of shop orders for the seller and admin pages and the JSON API. Pure. */

type Money = { toString(): string } | number | string;
const tk = (m: Money) => Number(m.toString());

export const ALL_STATUSES: readonly ShopOrderStatus[] = ["placed", "confirmed", "packed", "handed_over", "delivered", "cancelled", "refused", "returned"];

export interface ListRowLike {
  id: string;
  shopId: string;
  seq: number;
  status: ShopOrderStatus;
  statusChangedAt: Date;
  shopName: string;
  itemsSubtotal: Money;
  deliveryCharge: Money;
  total: Money;
  handoverDueAt: Date;
  handedOverAt: Date | null;
  overdueNotifiedAt: Date | null;
  courierName: string | null;
  trackingNo: string | null;
  order: { orderNo: string; contactName: string; zone: "inside_dhaka" | "outside_dhaka"; address: unknown; placedAt: Date };
  items: { id: string; title: string; variantLabel: string | null; sku: string | null; quantity: number; unitPrice: Money; lineTotal: Money }[];
}

export interface ShopOrderListView {
  id: string;
  shopId: string;
  shopName: string;
  shopOrderNo: string;
  orderNo: string;
  status: ShopOrderStatus;
  statusLabel: string;
  statusChangedAt: string;
  placedAt: string;
  customerName: string;
  zone: "inside_dhaka" | "outside_dhaka";
  address: AddressSnapshot;
  itemsSubtotal: number;
  deliveryCharge: number;
  total: number;
  itemCount: number;
  items: { id: string; title: string; variantLabel: string | null; sku: string | null; quantity: number; unitPrice: number; lineTotal: number }[];
  handoverDueAt: string;
  handedOverAt: string | null;
  /** Handed over after the 48 h deadline. */
  handedOverLate: boolean;
  overdue: boolean;
  overdueNotifiedAt: string | null;
  countdown: Countdown;
  courierName: string | null;
  trackingNo: string | null;
}

export function toListView(row: ListRowLike, now: Date): ShopOrderListView {
  return {
    id: row.id,
    shopId: row.shopId,
    shopName: row.shopName,
    shopOrderNo: shopOrderNo(row.order.orderNo, row.seq),
    orderNo: row.order.orderNo,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] ?? row.status,
    statusChangedAt: row.statusChangedAt.toISOString(),
    placedAt: row.order.placedAt.toISOString(),
    customerName: row.order.contactName,
    zone: row.order.zone,
    address: toAddress(row.order.address),
    itemsSubtotal: tk(row.itemsSubtotal),
    deliveryCharge: tk(row.deliveryCharge),
    total: tk(row.total),
    itemCount: row.items.reduce((n, i) => n + i.quantity, 0),
    items: row.items.map((i) => ({ id: i.id, title: i.title, variantLabel: i.variantLabel, sku: i.sku, quantity: i.quantity, unitPrice: tk(i.unitPrice), lineTotal: tk(i.lineTotal) })),
    handoverDueAt: row.handoverDueAt.toISOString(),
    handedOverAt: row.handedOverAt?.toISOString() ?? null,
    handedOverLate: !!row.handedOverAt && row.handedOverAt.getTime() > row.handoverDueAt.getTime(),
    overdue: isOverdue(row.status, row.handoverDueAt, now),
    overdueNotifiedAt: row.overdueNotifiedAt?.toISOString() ?? null,
    countdown: handoverCountdown(row.status, row.handoverDueAt, now),
    courierName: row.courierName,
    trackingNo: row.trackingNo,
  };
}

export interface DetailRowLike extends Omit<ListRowLike, "order"> {
  freeDelivery: boolean;
  weightGrams: number;
  cancelReason: string | null;
  cancelledBy: string | null;
  refusalNote: string | null;
  deliveredAt: Date | null;
  order: ListRowLike["order"] & { id: string; contactPhone: string };
  events: { action: string; fromStatus: string; toStatus: string; actorRole: string; note: string | null; restocked: boolean; at: Date }[];
}

export interface ShopOrderDetailView extends ShopOrderListView {
  customerPhone: string;
  freeDelivery: boolean;
  weightGrams: number;
  cancelReason: string | null;
  cancelledBy: string | null;
  refusalNote: string | null;
  deliveredAt: string | null;
  timeline: TimelineEntry[];
  /** What this viewer can do now. */
  actions: LifecycleAction[];
}

export function toDetailView(row: DetailRowLike, now: Date, actor: ActorRole, config: LifecycleConfig): ShopOrderDetailView {
  return {
    ...toListView(row, now),
    customerPhone: localPhone(row.order.contactPhone),
    freeDelivery: row.freeDelivery,
    weightGrams: row.weightGrams,
    cancelReason: row.cancelReason,
    cancelledBy: row.cancelledBy,
    refusalNote: row.refusalNote,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    timeline: buildTimeline({ status: row.status, statusChangedAt: row.statusChangedAt, placedAt: row.order.placedAt }, row.events),
    actions: availableActions(row.status, actor, config),
  };
}

/** List filters from a query string: `status` (one of the statuses) and `overdue=1`. */
export function parseFilters(params: { status?: unknown; overdue?: unknown; shopId?: unknown }): { status?: ShopOrderStatus; overdue: boolean; shopId?: string } {
  const status = typeof params.status === "string" && params.status ? params.status : undefined;
  if (status && !(ALL_STATUSES as readonly string[]).includes(status)) {
    throw new OrderError(422, "VALIDATION", "Unknown status filter", { status: `Use one of: ${ALL_STATUSES.join(", ")}` });
  }
  const overdue = params.overdue === "1" || params.overdue === "true";
  const shopId = typeof params.shopId === "string" && params.shopId.trim() ? params.shopId.trim() : undefined;
  return { status: status as ShopOrderStatus | undefined, overdue, shopId };
}

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { ShopOrderStatus } from "../config";
import { OrderError } from "../errors";
import { shopOrderNo } from "../order-no";
import { PRE_HANDOVER_STATUSES, type TransitionPlan } from "./machine";
import type { Actor, LifecycleStore, LifecycleTarget, ShopOrderTransitionEvent, TransitionTxHook } from "./service";

/**
 * Lifecycle data access. Shop reads take the shopId first and filter by it (ADR-004); customer
 * reads take the order id the caller was allowed to see; admin reads are only called after
 * requirePlatformAdmin. Shop orders and their events are never deleted (6-year records).
 */

export type Tx = Prisma.TransactionClient;

const targetSelect = {
  id: true,
  shopId: true,
  orderId: true,
  seq: true,
  status: true,
  order: { select: { orderNo: true } },
} satisfies Prisma.ShopOrderSelect;

type TargetRow = Prisma.ShopOrderGetPayload<{ select: typeof targetSelect }>;

const toTarget = (row: TargetRow | null): LifecycleTarget | null =>
  row ? { id: row.id, shopId: row.shopId, orderId: row.orderId, orderNo: row.order?.orderNo ?? "", seq: row.seq, status: row.status } : null;

export async function findForShop(shopId: string, shopOrderId: string) {
  return toTarget(await prisma.shopOrder.findFirst({ where: { id: shopOrderId, shopId }, select: targetSelect }));
}

export async function findForOrder(orderId: string, shopOrderId: string) {
  return toTarget(await prisma.shopOrder.findFirst({ where: { id: shopOrderId, orderId }, select: targetSelect }));
}

export async function findById(shopOrderId: string) {
  return toTarget(await prisma.shopOrder.findFirst({ where: { id: shopOrderId }, select: targetSelect }));
}

export async function apply(target: LifecycleTarget, plan: TransitionPlan, actor: Actor, hooks: readonly TransitionTxHook<Tx>[]): Promise<ShopOrderTransitionEvent> {
  return prisma.$transaction(async (tx) => {
    // Only from the status the plan was made for: a parallel change makes this a no-op.
    const { count } = await tx.shopOrder.updateMany({ where: { id: target.id, shopId: target.shopId, status: plan.from }, data: plan.patch });
    if (count !== 1) throw new OrderError(409, "STATUS_CHANGED", "This order changed in the meantime. Reload the page and try again.");

    const productIds = new Set<string>();
    if (plan.restock) {
      const items = await tx.orderItem.findMany({ where: { shopOrderId: target.id }, select: { variantId: true, productId: true, quantity: true } });
      for (const item of items) {
        // A variant the seller removed since keeps its snapshot only: nothing to put back.
        if (!item.variantId) continue;
        const { count: restocked } = await tx.productVariant.updateMany({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
        if (restocked) productIds.add(item.productId);
      }
    }

    const at = plan.patch.statusChangedAt;
    await tx.shopOrderEvent.create({
      data: {
        shopOrderId: target.id,
        action: plan.action,
        fromStatus: plan.from,
        toStatus: plan.to,
        actorId: actor.id,
        actorRole: actor.role,
        note: plan.note,
        restocked: plan.restock,
        at,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: `shop_order.${plan.action}`,
        entity: "shop_order",
        entityId: target.id,
        data: { from: plan.from, to: plan.to, actorRole: actor.role, note: plan.note, restocked: plan.restock, shopId: target.shopId },
      },
    });

    const event: ShopOrderTransitionEvent = {
      shopOrderId: target.id,
      shopId: target.shopId,
      orderId: target.orderId,
      orderNo: target.orderNo,
      shopOrderNo: shopOrderNo(target.orderNo, target.seq),
      action: plan.action,
      from: plan.from,
      to: plan.to,
      at,
      actorId: actor.id,
      actorRole: actor.role,
      note: plan.note,
      restocked: plan.restock,
      restockedProductIds: [...productIds],
    };
    for (const hook of hooks) await hook(tx, event);
    return event;
  });
}

export const lifecycleStore: LifecycleStore<Tx> = { findForShop, findForOrder, findById, apply };

// ---------- Lists and detail ----------

export interface ShopOrderFilters {
  status?: ShopOrderStatus;
  /** Only pre-handover shop orders past their 48 h deadline. */
  overdue?: boolean;
  take?: number;
}

const preHandover = [...PRE_HANDOVER_STATUSES];

function filterWhere(filters: ShopOrderFilters, now: Date): Prisma.ShopOrderWhereInput {
  if (filters.overdue) {
    const statuses = filters.status ? preHandover.filter((s) => s === filters.status) : preHandover;
    return { status: { in: statuses }, handoverDueAt: { lt: now } };
  }
  return filters.status ? { status: filters.status } : {};
}

export const listRowSelect = {
  id: true,
  shopId: true,
  seq: true,
  status: true,
  statusChangedAt: true,
  shopName: true,
  itemsSubtotal: true,
  deliveryCharge: true,
  total: true,
  handoverDueAt: true,
  handedOverAt: true,
  overdueNotifiedAt: true,
  courierName: true,
  trackingNo: true,
  createdAt: true,
  order: { select: { orderNo: true, contactName: true, zone: true, address: true, placedAt: true } },
  items: { select: { id: true, title: true, variantLabel: true, sku: true, quantity: true, unitPrice: true, lineTotal: true } },
} satisfies Prisma.ShopOrderSelect;

export type ShopOrderListRow = Prisma.ShopOrderGetPayload<{ select: typeof listRowSelect }>;

/** The shop's orders, newest first (overdue: oldest deadline first). Only shop orders of `shopId`. */
export function listForShop(shopId: string, filters: ShopOrderFilters, now: Date): Promise<ShopOrderListRow[]> {
  return prisma.shopOrder.findMany({
    where: { shopId, ...filterWhere(filters, now) },
    select: listRowSelect,
    orderBy: filters.overdue ? { handoverDueAt: "asc" } : { createdAt: "desc" },
    take: filters.take ?? 100,
  });
}

/** Admin: every shop's orders (call only after requirePlatformAdmin). */
export function listForAdmin(filters: ShopOrderFilters & { shopId?: string }, now: Date): Promise<ShopOrderListRow[]> {
  return prisma.shopOrder.findMany({
    where: { ...(filters.shopId ? { shopId: filters.shopId } : {}), ...filterWhere(filters, now) },
    select: listRowSelect,
    orderBy: filters.overdue ? { handoverDueAt: "asc" } : { createdAt: "desc" },
    take: filters.take ?? 200,
  });
}

/** Counts per filter for the tabs (shop scope, or every shop when shopId is null for the admin). */
export async function countOverdue(shopId: string | null, now: Date): Promise<number> {
  return prisma.shopOrder.count({ where: { ...(shopId ? { shopId } : {}), status: { in: preHandover }, handoverDueAt: { lt: now } } });
}

const eventSelect = { id: true, action: true, fromStatus: true, toStatus: true, actorRole: true, note: true, restocked: true, at: true } satisfies Prisma.ShopOrderEventSelect;

export const detailSelect = {
  ...listRowSelect,
  freeDelivery: true,
  weightGrams: true,
  cancelReason: true,
  cancelledBy: true,
  refusalNote: true,
  deliveredAt: true,
  order: { select: { id: true, orderNo: true, contactName: true, contactPhone: true, zone: true, address: true, placedAt: true } },
  events: { select: eventSelect, orderBy: { at: "asc" } },
} satisfies Prisma.ShopOrderSelect;

export type ShopOrderDetailRow = Prisma.ShopOrderGetPayload<{ select: typeof detailSelect }>;

/** One shop order of this shop with its customer, items and events; null for another shop's. */
export function getDetailForShop(shopId: string, shopOrderId: string): Promise<ShopOrderDetailRow | null> {
  return prisma.shopOrder.findFirst({ where: { id: shopOrderId, shopId }, select: detailSelect });
}

/** Admin: one shop order (call only after requirePlatformAdmin). */
export function getDetailForAdmin(shopOrderId: string): Promise<ShopOrderDetailRow | null> {
  return prisma.shopOrder.findFirst({ where: { id: shopOrderId }, select: detailSelect });
}

/** Timeline data of every shop order of one customer order (the caller checked the customer may see it). */
export function timelinesForOrder(orderId: string) {
  return prisma.shopOrder.findMany({
    where: { orderId },
    select: { id: true, status: true, statusChangedAt: true, courierName: true, trackingNo: true, events: { select: eventSelect, orderBy: { at: "asc" } } },
  });
}

// ---------- Handover timer and metric ----------

/** Pre-handover shop orders past the deadline whose alert has not gone out, oldest first. */
export function findNewlyOverdue(now: Date, limit: number) {
  return prisma.shopOrder.findMany({
    where: { status: { in: preHandover }, handoverDueAt: { lt: now }, overdueNotifiedAt: null },
    select: { id: true },
    orderBy: { handoverDueAt: "asc" },
    take: limit,
  });
}

/** Marks the overdue alert sent once (false when it was already marked or the order moved on). */
export async function markOverdueNotified(shopOrderId: string, now: Date): Promise<boolean> {
  const { count } = await prisma.shopOrder.updateMany({
    where: { id: shopOrderId, overdueNotifiedAt: null, status: { in: preHandover } },
    data: { overdueNotifiedAt: now },
  });
  return count === 1;
}

/** What the overdue alert needs: the shop order, its shop's members and the admins. */
export async function overdueAlertFacts(shopOrderId: string) {
  const so = await prisma.shopOrder.findFirst({
    where: { id: shopOrderId },
    select: {
      id: true,
      seq: true,
      shopId: true,
      shopName: true,
      status: true,
      handoverDueAt: true,
      order: { select: { orderNo: true } },
      shop: { select: { members: { select: { user: { select: { email: true, phone: true, status: true } } } } } },
    },
  });
  if (!so) return null;
  const admins = await prisma.user.findMany({ where: { isPlatformAdmin: true, status: "active", email: { not: null } }, select: { email: true } });
  return {
    id: so.id,
    shopOrderNo: shopOrderNo(so.order.orderNo, so.seq),
    shopId: so.shopId,
    shopName: so.shopName,
    status: so.status,
    handoverDueAt: so.handoverDueAt,
    members: so.shop.members.filter((m) => m.user.status === "active").map((m) => ({ email: m.user.email, phone: m.user.phone })),
    adminEmails: admins.map((a) => a.email).filter((e): e is string => !!e),
  };
}

/** The customer's mobile for a status SMS. */
export function orderContact(orderId: string) {
  return prisma.order.findFirst({ where: { id: orderId }, select: { contactPhone: true, orderNo: true } });
}

/** Facts for the handover-rate metric: shop orders placed in [from, to), one shop or all. */
export function handoverFacts(scope: { shopId: string | null; from: Date; to: Date }) {
  return prisma.shopOrder.findMany({
    where: { ...(scope.shopId ? { shopId: scope.shopId } : {}), createdAt: { gte: scope.from, lt: scope.to } },
    select: { status: true, handoverDueAt: true, handedOverAt: true, cancelledAt: true },
  });
}

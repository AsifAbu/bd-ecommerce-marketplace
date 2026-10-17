import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { COUNTED_RETURN_STATUSES, isFullyReturned, type ExistingReturn, type ReturnStatus } from "./rules";
import type { ItemForReturn, NewReturn, ReturnEffects, ReturnRecord, ReturnScope } from "./service";

/**
 * Returns data access (ADR-004). Every read takes its scope first: an order the customer may open
 * (orderId), the user's own orders (userId), a guard-checked shopId, or the admin. Return requests
 * are 6-year records: never deleted, closed with a status.
 */

export function scopeWhere(scope: ReturnScope): Prisma.ReturnRequestWhereInput {
  if (scope.kind === "order") return { orderId: scope.orderId };
  if (scope.kind === "shop") return { shopId: scope.shopId };
  return {};
}

const recordSelect = {
  id: true,
  orderId: true,
  shopOrderId: true,
  orderItemId: true,
  shopId: true,
  userId: true,
  quantity: true,
  reason: true,
  status: true,
  shopDueAt: true,
  shopRespondedAt: true,
  receivedAt: true,
  restockedAt: true,
  order: { select: { orderNo: true } },
  shopOrder: { select: { deliveryCharge: true } },
  orderItem: { select: { unitPrice: true, variantId: true } },
} satisfies Prisma.ReturnRequestSelect;

type RecordRow = Prisma.ReturnRequestGetPayload<{ select: typeof recordSelect }>;

const toRecord = (r: RecordRow): ReturnRecord => ({
  id: r.id,
  orderId: r.orderId,
  orderNo: r.order.orderNo,
  shopOrderId: r.shopOrderId,
  orderItemId: r.orderItemId,
  shopId: r.shopId,
  userId: r.userId,
  quantity: r.quantity,
  reason: r.reason,
  status: r.status,
  shopDueAt: r.shopDueAt,
  shopRespondedAt: r.shopRespondedAt,
  receivedAt: r.receivedAt,
  restockedAt: r.restockedAt,
  unitPrice: r.orderItem.unitPrice.toString(),
  variantId: r.orderItem.variantId,
  deliveryCharge: r.shopOrder.deliveryCharge.toString(),
});

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// ---------- ReturnsStore ----------

/** The item inside this order, its shop order, the order and earlier requests for it. */
export async function itemForReturn(orderId: string, orderItemId: string): Promise<ItemForReturn | null> {
  const item = await prisma.orderItem.findFirst({
    where: { id: orderItemId, shopOrder: { orderId } },
    select: {
      id: true,
      title: true,
      quantity: true,
      returnEligibility: true,
      product: { select: { attributes: true, category: { select: { requiresLicence: true } } } },
      shopOrder: {
        select: {
          id: true,
          shopId: true,
          status: true,
          deliveredAt: true,
          order: { select: { id: true, orderNo: true, userId: true, contactPhone: true, policyVersions: true } },
        },
      },
      returnRequests: { select: { status: true, quantity: true } },
    },
  });
  if (!item) return null;
  // Older order rows have no snapshot: fall back to the listing's current value.
  const current = isRecord(item.product.attributes) ? item.product.attributes.return_eligibility : null;
  const { order, ...shopOrder } = item.shopOrder;
  return {
    order,
    shopOrder,
    item: {
      id: item.id,
      title: item.title,
      quantity: item.quantity,
      returnEligibility: item.returnEligibility ?? (typeof current === "string" ? current : null),
      medicine: item.product.category.requiresLicence,
    },
    existing: item.returnRequests,
  };
}

export async function create(data: NewReturn, recheck: (existing: ExistingReturn[]) => void): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    // Lock the item so two requests for it can't both pass the "one open request" check.
    await tx.$queryRaw`SELECT id FROM order_item WHERE id = ${data.orderItemId} FOR UPDATE`;
    recheck(await tx.returnRequest.findMany({ where: { orderItemId: data.orderItemId }, select: { status: true, quantity: true } }));
    return tx.returnRequest.create({ data: { ...data, statusChangedAt: data.createdAt }, select: { id: true } });
  });
}

export async function find(scope: ReturnScope, id: string): Promise<ReturnRecord | null> {
  const row = await prisma.returnRequest.findFirst({ where: { id, ...scopeWhere(scope) }, select: recordSelect });
  return row ? toRecord(row) : null;
}

export async function update(id: string, from: readonly ReturnStatus[], data: Record<string, unknown>, effects: ReturnEffects = {}): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.returnRequest.updateMany({ where: { id, status: { in: [...from] } }, data: data as Prisma.ReturnRequestUpdateManyMutationInput });
    if (count !== 1) return false;
    if (effects.restock) {
      await tx.productVariant.updateMany({ where: { id: effects.restock.variantId }, data: { stock: { increment: effects.restock.quantity } } });
    }
    if (effects.completeShopOrder) {
      const r = await tx.returnRequest.findUnique({ where: { id }, select: { shopOrderId: true, refundedAt: true } });
      if (!r) return true;
      const [items, refunded] = await Promise.all([
        tx.orderItem.findMany({ where: { shopOrderId: r.shopOrderId }, select: { id: true, quantity: true } }),
        tx.returnRequest.findMany({ where: { shopOrderId: r.shopOrderId, status: "refunded" }, select: { orderItemId: true, quantity: true } }),
      ]);
      const back = (itemId: string) => refunded.filter((x) => x.orderItemId === itemId).reduce((n, x) => n + x.quantity, 0);
      if (isFullyReturned(items.map((i) => ({ quantity: i.quantity, refundedQuantity: back(i.id) })))) {
        await tx.shopOrder.updateMany({
          where: { id: r.shopOrderId, status: "delivered" },
          data: { status: "returned", statusChangedAt: r.refundedAt ?? new Date() },
        });
      }
    }
    return true;
  });
}

export async function deliveryAlreadyRefunded(shopOrderId: string, exceptId: string): Promise<boolean> {
  const n = await prisma.returnRequest.count({ where: { shopOrderId, id: { not: exceptId }, status: "refunded", refundDelivery: { gt: 0 } } });
  return n > 0;
}

export function listOverdue(now: Date, take: number) {
  return prisma.returnRequest.findMany({
    where: { status: "requested", shopDueAt: { lte: now } },
    select: { id: true, shopDueAt: true },
    orderBy: { shopDueAt: "asc" },
    take,
  });
}

export async function audit(actorId: string | null, action: string, returnId: string, data?: Record<string, unknown>) {
  await prisma.auditLog.create({ data: { actorId, action, entity: "return_request", entityId: returnId, data: data as Prisma.InputJsonValue } });
}

// ---------- Lists and details ----------

export const viewSelect = {
  id: true,
  quantity: true,
  reason: true,
  details: true,
  photoKeys: true,
  policyVersion: true,
  status: true,
  statusChangedAt: true,
  shopDueAt: true,
  shopRespondedAt: true,
  shopNote: true,
  escalatedAt: true,
  escalationReason: true,
  disputeNote: true,
  adminDecidedAt: true,
  adminNote: true,
  receivedAt: true,
  restockedAt: true,
  refundAmount: true,
  refundDelivery: true,
  refundMethod: true,
  refundReference: true,
  refundedAt: true,
  createdAt: true,
  shopId: true,
  order: { select: { orderNo: true, contactName: true } },
  shopOrder: { select: { id: true, seq: true, shopName: true, deliveryCharge: true, deliveredAt: true } },
  orderItem: { select: { id: true, title: true, variantLabel: true, sku: true, unitPrice: true, quantity: true } },
} satisfies Prisma.ReturnRequestSelect;

export type ReturnRow = Prisma.ReturnRequestGetPayload<{ select: typeof viewSelect }>;

/** The user's requests: asked from the account, or on orders that belong to it (linked guest orders too). */
export function listForUser(userId: string, take = 100): Promise<ReturnRow[]> {
  return prisma.returnRequest.findMany({ where: { OR: [{ userId }, { order: { userId } }] }, select: viewSelect, orderBy: { createdAt: "desc" }, take });
}

/** Requests on one order (the caller checked the customer may open it). */
export function listForOrder(orderId: string): Promise<ReturnRow[]> {
  return prisma.returnRequest.findMany({ where: { orderId }, select: viewSelect, orderBy: { createdAt: "desc" } });
}

/** The shop's requests, waiting ones first by due time. Only rows of `shopId`. */
export function listForShop(shopId: string, opts: { status?: ReturnStatus; take?: number } = {}): Promise<ReturnRow[]> {
  return prisma.returnRequest.findMany({
    where: { shopId, ...(opts.status ? { status: opts.status } : {}) },
    select: viewSelect,
    orderBy: [{ shopDueAt: "asc" }],
    take: opts.take ?? 200,
  });
}

/** Admin queue: escalated requests (default) or any status, oldest escalation first. */
export function listForAdmin(opts: { status?: ReturnStatus; take?: number } = {}): Promise<ReturnRow[]> {
  return prisma.returnRequest.findMany({
    where: { status: opts.status ?? "escalated" },
    select: viewSelect,
    orderBy: [{ escalatedAt: "asc" }, { createdAt: "asc" }],
    take: opts.take ?? 200,
  });
}

export function getRow(scope: ReturnScope, id: string): Promise<ReturnRow | null> {
  return prisma.returnRequest.findFirst({ where: { id, ...scopeWhere(scope) }, select: viewSelect });
}

/** The order a request belongs to (customer access is then checked through the order). */
export function orderNoOf(id: string): Promise<string | null> {
  return prisma.returnRequest.findUnique({ where: { id }, select: { order: { select: { orderNo: true } } } }).then((r) => r?.order.orderNo ?? null);
}

// ---------- Figures for payouts (US-082), seller score (US-059) and metrics (US-083) ----------

export interface ShopOrderRefund {
  shopOrderId: string;
  /** Tk refunded in total, of which the delivery charge. */
  refunded: number;
  delivery: number;
  /** Units refunded. */
  units: number;
}

/**
 * Refunds recorded per shop order of this shop (payout ledger: deduct `refunded` from what the shop
 * is owed). Pass shop order ids to limit it.
 */
export async function refundsByShopOrder(shopId: string, shopOrderIds?: readonly string[]): Promise<ShopOrderRefund[]> {
  const rows = await prisma.returnRequest.groupBy({
    by: ["shopOrderId"],
    where: { shopId, status: "refunded", ...(shopOrderIds ? { shopOrderId: { in: [...shopOrderIds] } } : {}) },
    _sum: { refundAmount: true, refundDelivery: true, quantity: true },
  });
  return rows.map((r) => ({
    shopOrderId: r.shopOrderId,
    refunded: Number(r._sum.refundAmount?.toString() ?? 0),
    delivery: Number(r._sum.refundDelivery?.toString() ?? 0),
    units: r._sum.quantity ?? 0,
  }));
}

export interface ReturnStats {
  /** Delivered (or returned) shop orders in the period, by delivery date. */
  deliveredShopOrders: number;
  /** Of those, shop orders with at least one return request that was not cancelled, rejected or denied. */
  shopOrdersWithReturns: number;
  /** shopOrdersWithReturns / deliveredShopOrders (0 when nothing was delivered). */
  returnRate: number;
  refundedAmount: number;
  refundedRequests: number;
  /** Requests the shop answered within 48 h / requests it had to answer. */
  answeredOnTimeRate: number;
}

/** Return figures for one shop (seller score US-059) or the whole marketplace (metrics US-083). */
export async function returnStats(opts: { shopId?: string; from: Date; to: Date }): Promise<ReturnStats> {
  const shop = opts.shopId ? { shopId: opts.shopId } : {};
  const delivered = { ...shop, deliveredAt: { gte: opts.from, lt: opts.to }, status: { in: ["delivered" as const, "returned" as const] } };
  const [deliveredShopOrders, withReturns, refunds, answerable] = await Promise.all([
    prisma.shopOrder.count({ where: delivered }),
    prisma.shopOrder.count({ where: { ...delivered, returnRequests: { some: { status: { in: [...COUNTED_RETURN_STATUSES] } } } } }),
    prisma.returnRequest.aggregate({ where: { ...shop, status: "refunded", refundedAt: { gte: opts.from, lt: opts.to } }, _sum: { refundAmount: true }, _count: true }),
    prisma.returnRequest.findMany({
      where: { ...shop, createdAt: { gte: opts.from, lt: opts.to }, status: { not: "cancelled" } },
      select: { shopDueAt: true, shopRespondedAt: true },
    }),
  ]);
  const onTime = answerable.filter((r) => r.shopRespondedAt && r.shopRespondedAt <= r.shopDueAt).length;
  return {
    deliveredShopOrders,
    shopOrdersWithReturns: withReturns,
    returnRate: deliveredShopOrders ? withReturns / deliveredShopOrders : 0,
    refundedAmount: Number(refunds._sum.refundAmount?.toString() ?? 0),
    refundedRequests: refunds._count,
    answeredOnTimeRate: answerable.length ? onTime / answerable.length : 1,
  };
}

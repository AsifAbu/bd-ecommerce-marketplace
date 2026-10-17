import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { PayoutError } from "./errors";
import { collectionAmounts, computePayout, payoutDueAt, type DeliveryChargesTo, type PayoutMethod } from "./ledger";
import { paisaToDecimal } from "./money";

/**
 * Payout ledger data access. Shop reads take the shopId first and filter by it (ADR-004); admin
 * functions are only called after requirePlatformAdmin. Collections and payouts are 6-year
 * records: never deleted; a payout is closed as paid or cancelled.
 */

export type Tx = Prisma.TransactionClient;

const isUniqueViolation = (err: unknown) => typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";

export interface RecordCollectionInput {
  shopOrderId: string;
  collectedAt: Date;
  recordedById: string | null;
  source: "auto_on_delivery" | "admin_manual";
  payoutDays: number;
}

/**
 * Records the cash collected for a delivered shop order, inside the caller's transaction (the
 * lifecycle's "delivered" change, or the admin's manual record). Returns created: false when the
 * shop order already has its collection (one per shop order).
 */
export async function recordCollectionTx(tx: Tx, input: RecordCollectionInput): Promise<{ id: string; created: boolean }> {
  const existing = await tx.codCollection.findFirst({ where: { shopOrderId: input.shopOrderId }, select: { id: true } });
  if (existing) return { id: existing.id, created: false };
  const so = await tx.shopOrder.findFirst({
    where: { id: input.shopOrderId },
    select: { shopId: true, status: true, total: true, itemsSubtotal: true, commissionAmount: true, launchOffer: true },
  });
  if (!so) throw new PayoutError(404, "NOT_FOUND", "Shop order not found");
  if (so.status !== "delivered") throw new PayoutError(409, "NOT_DELIVERED", "Only a delivered order's cash can be recorded as collected.");
  const a = collectionAmounts(so);
  const row = await tx.codCollection.create({
    data: {
      shopOrderId: input.shopOrderId,
      shopId: so.shopId,
      amount: paisaToDecimal(a.amount),
      itemsAmount: paisaToDecimal(a.itemsAmount),
      deliveryCharge: paisaToDecimal(a.deliveryCharge),
      commission: paisaToDecimal(a.commission),
      collectedAt: input.collectedAt,
      source: input.source,
      recordedById: input.recordedById,
      payoutDueAt: payoutDueAt(input.collectedAt, input.payoutDays),
    },
    select: { id: true },
  });
  await tx.auditLog.create({
    data: {
      actorId: input.recordedById,
      action: "cod_collection.recorded",
      entity: "cod_collection",
      entityId: row.id,
      data: { shopOrderId: input.shopOrderId, shopId: so.shopId, amount: paisaToDecimal(a.amount), source: input.source },
    },
  });
  return { id: row.id, created: true };
}

/** Admin: record the collection of a delivered shop order by hand (manual mode, or older orders). */
export async function recordCollectionManually(shopOrderId: string, actorId: string, now: Date, payoutDays: number) {
  try {
    const result = await prisma.$transaction((tx) => recordCollectionTx(tx, { shopOrderId, collectedAt: now, recordedById: actorId, source: "admin_manual", payoutDays }));
    if (!result.created) throw new PayoutError(409, "ALREADY_RECORDED", "This order's collection is already recorded.");
    return result;
  } catch (err) {
    if (isUniqueViolation(err)) throw new PayoutError(409, "ALREADY_RECORDED", "This order's collection is already recorded.");
    throw err;
  }
}

// ---------- Reads ----------

export const collectionSelect = {
  id: true,
  shopId: true,
  shopOrderId: true,
  amount: true,
  itemsAmount: true,
  deliveryCharge: true,
  commission: true,
  collectedAt: true,
  source: true,
  payoutDueAt: true,
  payoutId: true,
  paidOutAt: true,
  shop: { select: { name: true } },
  shopOrder: { select: { seq: true, status: true, launchOffer: true, order: { select: { orderNo: true } } } },
  payout: { select: { status: true } },
} satisfies Prisma.CodCollectionSelect;

export type CollectionRow = Prisma.CodCollectionGetPayload<{ select: typeof collectionSelect }>;

export const payoutSelect = {
  id: true,
  shopId: true,
  periodStart: true,
  periodEnd: true,
  collectionCount: true,
  gross: true,
  commission: true,
  deliveryCharges: true,
  deliveryChargesTo: true,
  net: true,
  status: true,
  dueAt: true,
  paidAt: true,
  method: true,
  reference: true,
  cancelledAt: true,
  cancelReason: true,
  createdAt: true,
  shop: { select: { name: true } },
} satisfies Prisma.PayoutSelect;

export type PayoutRow = Prisma.PayoutGetPayload<{ select: typeof payoutSelect }>;

/** The shop's collections, newest first. Only rows of `shopId`. */
export function listCollectionsForShop(shopId: string, take = 200): Promise<CollectionRow[]> {
  return prisma.codCollection.findMany({ where: { shopId }, select: collectionSelect, orderBy: { collectedAt: "desc" }, take });
}

/** The shop's payouts, newest first. Only rows of `shopId`. */
export function listPayoutsForShop(shopId: string, take = 100): Promise<PayoutRow[]> {
  return prisma.payout.findMany({ where: { shopId }, select: payoutSelect, orderBy: { createdAt: "desc" }, take });
}

/** One payout of this shop; null for another shop's. */
export function getPayoutForShop(shopId: string, payoutId: string): Promise<PayoutRow | null> {
  return prisma.payout.findFirst({ where: { id: payoutId, shopId }, select: payoutSelect });
}

/** Admin: every collection not yet in a payout (oldest deadline first). */
export function listUnbatchedCollections(take = 1000): Promise<CollectionRow[]> {
  return prisma.codCollection.findMany({ where: { payoutId: null, paidOutAt: null }, select: collectionSelect, orderBy: { payoutDueAt: "asc" }, take });
}

/** Admin: payouts, newest first, optionally by status. */
export function listPayouts(filters: { status?: "pending" | "paid" | "cancelled"; take?: number } = {}): Promise<PayoutRow[]> {
  return prisma.payout.findMany({
    where: filters.status ? { status: filters.status } : {},
    select: payoutSelect,
    orderBy: { createdAt: "desc" },
    take: filters.take ?? 100,
  });
}

/** Admin: delivered shop orders with no collection yet (manual mode, or delivered before the ledger). */
export function deliveredWithoutCollection(take = 100) {
  return prisma.shopOrder.findMany({
    where: { status: "delivered", codCollection: { is: null } },
    select: { id: true, seq: true, shopName: true, total: true, deliveredAt: true, order: { select: { orderNo: true } } },
    orderBy: { deliveredAt: "asc" },
    take,
  });
}

/** Unpaid collections of delivered shop orders due before `until` (the daily 10-day check). */
export function unpaidCollectionsDueBefore(until: Date): Promise<CollectionRow[]> {
  return prisma.codCollection.findMany({
    where: { paidOutAt: null, payoutDueAt: { lt: until }, shopOrder: { status: "delivered" } },
    select: collectionSelect,
    orderBy: { payoutDueAt: "asc" },
  });
}

// ---------- Admin writes ----------

/**
 * Batches every unpaid collection of the shop's delivered shop orders into one pending payout.
 * One transaction: the collections are claimed only if still free (a parallel batch gets 409).
 */
export async function createPayoutBatch(shopId: string, actorId: string, deliveryChargesTo: DeliveryChargesTo): Promise<PayoutRow> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.codCollection.findMany({
      where: { shopId, payoutId: null, paidOutAt: null, shopOrder: { status: "delivered" } },
      select: { id: true, amount: true, deliveryCharge: true, commission: true, collectedAt: true, payoutDueAt: true },
      orderBy: { collectedAt: "asc" },
    });
    if (rows.length === 0) throw new PayoutError(409, "NOTHING_TO_PAY", "This shop has no unpaid collections of delivered orders.");
    const t = computePayout(rows, deliveryChargesTo);
    const payout = await tx.payout.create({
      data: {
        shopId,
        periodStart: t.periodStart,
        periodEnd: t.periodEnd,
        collectionCount: t.count,
        gross: paisaToDecimal(t.gross),
        commission: paisaToDecimal(t.commission),
        deliveryCharges: paisaToDecimal(t.deliveryCharges),
        deliveryChargesTo: t.deliveryChargesTo,
        net: paisaToDecimal(t.net),
        status: "pending",
        dueAt: t.dueAt,
        createdById: actorId,
      },
      select: { id: true },
    });
    const ids = rows.map((r) => r.id);
    const { count } = await tx.codCollection.updateMany({ where: { id: { in: ids }, shopId, payoutId: null }, data: { payoutId: payout.id } });
    if (count !== ids.length) throw new PayoutError(409, "CONFLICT", "These collections were just batched by someone else. Reload and try again.");
    await tx.auditLog.create({
      data: { actorId, action: "payout.created", entity: "payout", entityId: payout.id, data: { shopId, collections: ids, net: paisaToDecimal(t.net), deliveryChargesTo } },
    });
    const created = await tx.payout.findFirst({ where: { id: payout.id }, select: payoutSelect });
    if (!created) throw new Error("payout vanished");
    return created;
  });
}

/** Marks a pending payout paid (method + reference); its collections get paidOutAt. */
export async function markPayoutPaid(payoutId: string, input: { method: PayoutMethod; reference: string }, actorId: string, now: Date): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.payout.updateMany({
      where: { id: payoutId, status: "pending" },
      data: { status: "paid", paidAt: now, method: input.method, reference: input.reference, recordedById: actorId },
    });
    if (count !== 1) throw new PayoutError(409, "NOT_PENDING", "Only a pending payout can be marked paid.");
    await tx.codCollection.updateMany({ where: { payoutId }, data: { paidOutAt: now } });
    await tx.auditLog.create({ data: { actorId, action: "payout.paid", entity: "payout", entityId: payoutId, data: { method: input.method, reference: input.reference } } });
  });
}

/** Voids a pending payout; its collections are free again for the next batch. */
export async function cancelPayout(payoutId: string, reason: string, actorId: string, now: Date): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.payout.updateMany({ where: { id: payoutId, status: "pending" }, data: { status: "cancelled", cancelledAt: now, cancelReason: reason } });
    if (count !== 1) throw new PayoutError(409, "NOT_PENDING", "Only a pending payout can be cancelled.");
    const released = await tx.codCollection.findMany({ where: { payoutId }, select: { id: true } });
    await tx.codCollection.updateMany({ where: { payoutId }, data: { payoutId: null } });
    await tx.auditLog.create({
      data: { actorId, action: "payout.cancelled", entity: "payout", entityId: payoutId, data: { reason, collections: released.map((r) => r.id) } },
    });
  });
}

/** Active Platform Admin emails (the daily payout check). */
export async function adminEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({ where: { isPlatformAdmin: true, status: "active", email: { not: null } }, select: { email: true } });
  return admins.map((a) => a.email).filter((e): e is string => !!e);
}

import { liveProductWhere } from "@/features/products";
import { dhakaToday } from "@/features/shops";
import { prisma } from "@/lib/db";

/**
 * Read-only queries for the marketplace metrics (US-083) and the seller score inputs (US-059).
 * The one write is `saveScores`, which sets the two score columns on `shop`. Windows are [from, to).
 * Counts are shop orders (one parcel per shop) unless named "customer orders".
 */

const between = (from: Date, to: Date) => ({ gte: from, lt: to });
const num = (d: { toString(): string } | null | undefined) => Number(d?.toString() ?? 0);

export const countApprovedShops = () => prisma.shop.count({ where: { status: "approved" } });

export const countLiveListings = (now: Date) => prisma.product.count({ where: liveProductWhere(dhakaToday(now)) });

/** Approved shops with at least one shop order placed in the window. */
export async function shopsWithOrders(from: Date, to: Date): Promise<Set<string>> {
  const rows = await prisma.shopOrder.groupBy({ by: ["shopId"], where: { createdAt: between(from, to), shop: { status: "approved" } } });
  return new Set(rows.map((r) => r.shopId));
}

export const countShopOrdersPlaced = (from: Date, to: Date) => prisma.shopOrder.count({ where: { createdAt: between(from, to) } });
export const countCustomerOrdersPlaced = (from: Date, to: Date) => prisma.order.count({ where: { placedAt: between(from, to) } });
export const countRefused = (from: Date, to: Date) => prisma.shopOrder.count({ where: { refusedAt: between(from, to) } });

/** Delivered shop orders in the window (delivery date), for GMV and top shops. */
export async function deliveredRows(from: Date, to: Date): Promise<{ shopId: string; deliveredAt: Date; total: number }[]> {
  const rows = await prisma.shopOrder.findMany({ where: { deliveredAt: between(from, to) }, select: { shopId: true, deliveredAt: true, total: true } });
  return rows.map((r) => ({ shopId: r.shopId, deliveredAt: r.deliveredAt!, total: num(r.total) }));
}

/** One row per delivered shop order with the buyer (verified phone) and the customer order. */
export async function deliveredBuyers(from: Date, to: Date): Promise<{ buyerKey: string; orderId: string }[]> {
  const rows = await prisma.shopOrder.findMany({
    where: { deliveredAt: between(from, to) },
    select: { orderId: true, order: { select: { contactPhone: true } } },
  });
  return rows.map((r) => ({ buyerKey: r.order.contactPhone, orderId: r.orderId }));
}

/**
 * Open carts started in the window: distinct owners (account or guest device) with a line that is
 * not saved for later. The cart table keeps no history, so this stands in for abandoned carts.
 */
export async function countOpenCarts(from: Date, to: Date): Promise<number> {
  const rows = await prisma.cartItem.findMany({
    where: { createdAt: between(from, to), savedForLater: false },
    select: { userId: true, guestToken: true },
  });
  return new Set(rows.map((r) => r.userId ?? `g:${r.guestToken}`)).size;
}

export async function shopNames(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await prisma.shop.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** Delivered and refused shop-order counts per shop in the window (the score's volume gate). */
export async function outcomeCountsByShop(from: Date, to: Date): Promise<Map<string, { delivered: number; refused: number }>> {
  const [delivered, refused] = await Promise.all([
    prisma.shopOrder.groupBy({ by: ["shopId"], where: { deliveredAt: between(from, to) }, _count: { _all: true } }),
    prisma.shopOrder.groupBy({ by: ["shopId"], where: { refusedAt: between(from, to) }, _count: { _all: true } }),
  ]);
  const out = new Map<string, { delivered: number; refused: number }>();
  for (const r of delivered) out.set(r.shopId, { delivered: r._count._all, refused: 0 });
  for (const r of refused) out.set(r.shopId, { delivered: out.get(r.shopId)?.delivered ?? 0, refused: r._count._all });
  return out;
}

export async function approvedShopIds(): Promise<string[]> {
  return (await prisma.shop.findMany({ where: { status: "approved" }, select: { id: true } })).map((s) => s.id);
}

export interface StoredScore {
  shopId: string;
  score: number | null;
  updatedAt: Date | null;
}

/** The stored score of each shop (null score = "New seller" or never computed). */
export async function storedScores(shopIds: string[]): Promise<Map<string, StoredScore>> {
  if (!shopIds.length) return new Map();
  const rows = await prisma.shop.findMany({ where: { id: { in: shopIds } }, select: { id: true, performanceScore: true, performanceUpdatedAt: true } });
  return new Map(rows.map((r) => [r.id, { shopId: r.id, score: r.performanceScore, updatedAt: r.performanceUpdatedAt }]));
}

/** Write scores (the only write of this feature). Each shop is its own update. */
export async function saveScores(rows: { shopId: string; score: number | null }[], now: Date): Promise<void> {
  await prisma.$transaction(rows.map((r) => prisma.shop.update({ where: { id: r.shopId }, data: { performanceScore: r.score, performanceUpdatedAt: now } })));
}

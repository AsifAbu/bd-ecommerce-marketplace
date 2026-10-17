import { dueState, isPayable, netOf, type DeliveryChargesTo, type DueState } from "./ledger";
import { sumPaisa, toPaisa, type MoneyLike } from "./money";

/** Plain view models of the ledger for pages and the JSON API (amounts in paisa). Pure. */

export interface CollectionRowLike {
  id: string;
  shopId: string;
  shopOrderId: string;
  amount: MoneyLike;
  deliveryCharge: MoneyLike;
  commission: MoneyLike;
  collectedAt: Date;
  source: string;
  payoutDueAt: Date;
  payoutId: string | null;
  paidOutAt: Date | null;
  shop?: { name: string } | null;
  shopOrder: { seq: number; status: string; launchOffer: boolean; order: { orderNo: string } };
  payout?: { status: string } | null;
}

export interface CollectionView {
  id: string;
  shopId: string;
  shopName: string;
  shopOrderId: string;
  shopOrderNo: string;
  shopOrderStatus: string;
  amount: number;
  deliveryCharge: number;
  commission: number;
  launchOffer: boolean;
  /** What the shop gets for it (paisa). */
  net: number;
  collectedAt: string;
  payoutDueAt: string;
  source: string;
  payoutId: string | null;
  paidOutAt: string | null;
  dueState: DueState;
  /** False for refused/returned shop orders: never paid out. */
  payable: boolean;
}

export function toCollectionView(row: CollectionRowLike, deliveryChargesTo: DeliveryChargesTo, now: Date, dueSoonDays = 2): CollectionView {
  return {
    id: row.id,
    shopId: row.shopId,
    shopName: row.shop?.name ?? "",
    shopOrderId: row.shopOrderId,
    shopOrderNo: `${row.shopOrder.order.orderNo}-${row.shopOrder.seq}`,
    shopOrderStatus: row.shopOrder.status,
    amount: toPaisa(row.amount),
    deliveryCharge: toPaisa(row.deliveryCharge),
    commission: toPaisa(row.commission),
    launchOffer: row.shopOrder.launchOffer,
    net: netOf(row, deliveryChargesTo),
    collectedAt: row.collectedAt.toISOString(),
    payoutDueAt: row.payoutDueAt.toISOString(),
    source: row.source,
    payoutId: row.payoutId,
    paidOutAt: row.paidOutAt?.toISOString() ?? null,
    dueState: dueState(row.payoutDueAt, row.paidOutAt, now, dueSoonDays),
    payable: row.paidOutAt !== null || row.shopOrder.status === "delivered",
  };
}

export interface PayoutRowLike {
  id: string;
  shopId: string;
  periodStart: Date;
  periodEnd: Date;
  collectionCount: number;
  gross: MoneyLike;
  commission: MoneyLike;
  deliveryCharges: MoneyLike;
  deliveryChargesTo: DeliveryChargesTo;
  net: MoneyLike;
  status: "pending" | "paid" | "cancelled";
  dueAt: Date;
  paidAt: Date | null;
  method: string | null;
  reference: string | null;
  cancelReason: string | null;
  createdAt: Date;
  shop?: { name: string } | null;
}

export interface PayoutView {
  id: string;
  shopId: string;
  shopName: string;
  periodStart: string;
  periodEnd: string;
  collectionCount: number;
  gross: number;
  commission: number;
  deliveryCharges: number;
  deliveryChargesTo: DeliveryChargesTo;
  net: number;
  status: "pending" | "paid" | "cancelled";
  dueAt: string;
  /** Pending past the 10-day deadline. */
  overdue: boolean;
  paidAt: string | null;
  method: string | null;
  reference: string | null;
  cancelReason: string | null;
  createdAt: string;
}

export function toPayoutView(row: PayoutRowLike, now: Date): PayoutView {
  return {
    id: row.id,
    shopId: row.shopId,
    shopName: row.shop?.name ?? "",
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    collectionCount: row.collectionCount,
    gross: toPaisa(row.gross),
    commission: toPaisa(row.commission),
    deliveryCharges: toPaisa(row.deliveryCharges),
    deliveryChargesTo: row.deliveryChargesTo,
    net: toPaisa(row.net),
    status: row.status,
    dueAt: row.dueAt.toISOString(),
    overdue: row.status === "pending" && row.dueAt.getTime() < now.getTime(),
    paidAt: row.paidAt?.toISOString() ?? null,
    method: row.method,
    reference: row.reference,
    cancelReason: row.cancelReason,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface ShopDueSummary {
  shopId: string;
  shopName: string;
  /** Collections of delivered shop orders, not in a payout yet. */
  payableCount: number;
  gross: number;
  commission: number;
  net: number;
  earliestDueAt: string | null;
  state: DueState | null;
  /** Collections whose shop order was returned/refused afterwards: never paid out. */
  excludedCount: number;
}

const STATE_ORDER: DueState[] = ["overdue", "due_soon", "upcoming", "paid"];

/** Admin "collections due" table: unbatched collections grouped by shop, most urgent first. */
export function summarizeUnbatched(rows: readonly CollectionRowLike[], deliveryChargesTo: DeliveryChargesTo, now: Date, dueSoonDays = 2): ShopDueSummary[] {
  const byShop = new Map<string, CollectionRowLike[]>();
  for (const r of rows) byShop.set(r.shopId, [...(byShop.get(r.shopId) ?? []), r]);
  const out: ShopDueSummary[] = [];
  for (const [shopId, list] of byShop) {
    const payable = list.filter((r) => isPayable({ payoutId: r.payoutId, shopOrderStatus: r.shopOrder.status }));
    const earliest = payable.length ? new Date(Math.min(...payable.map((r) => r.payoutDueAt.getTime()))) : null;
    out.push({
      shopId,
      shopName: list[0].shop?.name ?? "",
      payableCount: payable.length,
      gross: sumPaisa(payable.map((r) => toPaisa(r.amount))),
      commission: sumPaisa(payable.map((r) => toPaisa(r.commission))),
      net: sumPaisa(payable.map((r) => netOf(r, deliveryChargesTo))),
      earliestDueAt: earliest?.toISOString() ?? null,
      state: earliest ? dueState(earliest, null, now, dueSoonDays) : null,
      excludedCount: list.length - payable.length,
    });
  }
  const rank = (s: ShopDueSummary) => (s.state ? STATE_ORDER.indexOf(s.state) : 99);
  return out.sort((a, b) => rank(a) - rank(b) || (a.earliestDueAt ?? "").localeCompare(b.earliestDueAt ?? ""));
}

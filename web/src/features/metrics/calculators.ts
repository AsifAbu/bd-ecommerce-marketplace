import { dayKeys, dhakaDayKey, type Window } from "./windows";

/** met / not met against the plan target; no data yet; or tracked only (the plan sets no target). */
export type TargetStatus = "met" | "not_met" | "no_data" | "tracked";

export const ratio = (n: number, d: number): number | null => (d > 0 ? n / d : null);

/** Compare a value with its target (higher is better). `null` target = tracked only. */
export function targetStatus(value: number | null, target: number | null): TargetStatus {
  if (value === null) return "no_data";
  if (target === null) return "tracked";
  return value >= target ? "met" : "not_met";
}

export const STATUS_LABELS: Record<TargetStatus, string> = {
  met: "Target met",
  not_met: "Target not met",
  no_data: "No data yet",
  tracked: "Tracked, no target yet",
};

const toPaisa = (taka: number) => Math.round(taka * 100);

export interface GmvDay {
  /** Dhaka calendar day, "2026-10-17". */
  day: string;
  /** Tk, from delivered shop-order totals (items + delivery, as collected). */
  amount: number;
  orders: number;
}

/** GMV per Dhaka day: the sum of delivered shop-order totals, a row for every day of the window. */
export function gmvByDay(rows: readonly { deliveredAt: Date; total: number }[], window: Window): GmvDay[] {
  const byDay = new Map(dayKeys(window).map((d) => [d, { paisa: 0, orders: 0 }]));
  for (const r of rows) {
    const bucket = byDay.get(dhakaDayKey(r.deliveredAt));
    if (!bucket) continue;
    bucket.paisa += toPaisa(r.total);
    bucket.orders++;
  }
  return [...byDay].map(([day, b]) => ({ day, amount: b.paisa / 100, orders: b.orders }));
}

export const sumGmv = (days: readonly GmvDay[]) => days.reduce((s, d) => s + Math.round(d.amount * 100), 0) / 100;

/** Sum GMV days into weeks (Monday-start, Dhaka) or months for the longer reports. */
export function gmvBy(days: readonly GmvDay[], unit: "week" | "month"): GmvDay[] {
  const out = new Map<string, { paisa: number; orders: number }>();
  for (const d of days) {
    const date = new Date(`${d.day}T00:00:00Z`);
    let key: string;
    if (unit === "month") key = d.day.slice(0, 7);
    else {
      const monday = new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * 86_400_000);
      key = monday.toISOString().slice(0, 10);
    }
    const b = out.get(key) ?? { paisa: 0, orders: 0 };
    b.paisa += Math.round(d.amount * 100);
    b.orders += d.orders;
    out.set(key, b);
  }
  return [...out].map(([day, b]) => ({ day, amount: b.paisa / 100, orders: b.orders }));
}

/** Delivered / (delivered + refused): the plan's "COD delivery success" (target 90%). */
export const codSuccessRate = (delivered: number, refused: number) => ratio(delivered, delivered + refused);

/** Refused parcels / shop orders placed in the same window. */
export const refusalRate = (refused: number, placed: number) => ratio(refused, placed);

export interface RepeatBuyers {
  buyers: number;
  repeat: number;
  share: number | null;
}

/**
 * Buyers with at least one delivered order, and those with two or more distinct delivered orders.
 * A buyer is the verified phone number on the order (guest and account orders share it).
 */
export function repeatBuyers(rows: readonly { buyerKey: string; orderId: string }[]): RepeatBuyers {
  const orders = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = orders.get(r.buyerKey) ?? new Set<string>();
    set.add(r.orderId);
    orders.set(r.buyerKey, set);
  }
  const repeat = [...orders.values()].filter((s) => s.size >= 2).length;
  return { buyers: orders.size, repeat, share: ratio(repeat, orders.size) };
}

export interface Retention {
  /** Shops with an order in the earlier window. */
  base: number;
  /** Of those, shops that also had an order in the later window. */
  kept: number;
  rate: number | null;
}

/** Seller retention: shops ordering in both of the last two windows / shops ordering in the earlier one. */
export function sellerRetention(earlier: ReadonlySet<string>, later: ReadonlySet<string>): Retention {
  let kept = 0;
  for (const id of earlier) if (later.has(id)) kept++;
  return { base: earlier.size, kept, rate: ratio(kept, earlier.size) };
}

/**
 * Cart-to-order rate, an honest proxy: the cart table keeps no history (lines are deleted at
 * checkout), so carts created cannot be counted. Instead: customer orders placed / (orders placed +
 * carts still holding items that were started in the window). Carts left open count as abandoned.
 */
export const cartToOrderProxy = (ordersPlaced: number, openCarts: number) => ratio(ordersPlaced, ordersPlaced + openCarts);

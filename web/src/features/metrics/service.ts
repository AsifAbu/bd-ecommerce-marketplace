import {
  cartToOrderProxy,
  codSuccessRate,
  gmvByDay,
  ratio,
  refusalRate,
  repeatBuyers,
  sellerRetention,
  sumGmv,
  targetStatus,
  type GmvDay,
  type TargetStatus,
} from "./calculators";
import {
  ACTIVE_SHOP_DAYS,
  REPEAT_BUYER_DAYS,
  RETENTION_WINDOW_DAYS,
  SCORE_WINDOW_DAYS,
  TARGETS,
} from "./config";
import { computeSellerScore, type ScoreInputs, type SellerScore } from "./score";
import { lastDays, rolling, type Window } from "./windows";

export type TileFormat = "count" | "percent" | "money" | "rating";

export interface Tile {
  key: string;
  label: string;
  value: number | null;
  format: TileFormat;
  target: number | null;
  status: TargetStatus;
  /** What the number means and which period it covers. */
  detail: string;
}

export interface TopShop {
  shopId: string;
  name: string;
  gmv: number;
  orders: number;
}

export interface AttentionItem {
  label: string;
  count: number;
  href: string;
  /** A few examples to look at first. */
  examples: string[];
}

export interface MetricsDashboard {
  generatedAt: string;
  days: number;
  from: string;
  to: string;
  tiles: Tile[];
  gmv: { total: number; orders: number; byDay: GmvDay[] };
  topShops: TopShop[];
  attention: AttentionItem[];
}

/** What the service needs from the data layer and from the other features' public APIs. */
export interface MetricsDeps {
  repo: {
    countApprovedShops(): Promise<number>;
    countLiveListings(now: Date): Promise<number>;
    shopsWithOrders(from: Date, to: Date): Promise<Set<string>>;
    countShopOrdersPlaced(from: Date, to: Date): Promise<number>;
    countCustomerOrdersPlaced(from: Date, to: Date): Promise<number>;
    countRefused(from: Date, to: Date): Promise<number>;
    deliveredRows(from: Date, to: Date): Promise<{ shopId: string; deliveredAt: Date; total: number }[]>;
    deliveredBuyers(from: Date, to: Date): Promise<{ buyerKey: string; orderId: string }[]>;
    countOpenCarts(from: Date, to: Date): Promise<number>;
    shopNames(ids: string[]): Promise<Map<string, string>>;
    outcomeCountsByShop(from: Date, to: Date): Promise<Map<string, { delivered: number; refused: number }>>;
    approvedShopIds(): Promise<string[]>;
    saveScores(rows: { shopId: string; score: number | null }[], now: Date): Promise<void>;
  };
  handoverRate(scope: { shopId: string | null; from: Date; to: Date }, now: Date): Promise<{ rate: number | null; eligible: number }>;
  returnStats(opts: { shopId?: string; from: Date; to: Date }): Promise<{ deliveredShopOrders: number; returnRate: number }>;
  complaintStats(opts: { shopId?: string; from: Date; to: Date; now?: Date }): Promise<{ opened: number; closed: number; closedOnTimeRate: number; overdueNow: number }>;
  shopRating(shopId: string, window: { from: Date; to: Date }): Promise<{ count: number; average: number | null }>;
  reviewMetrics(range: { from: Date; to: Date }): Promise<{ averageRating: number | null; visible: number }>;
  /** Needs-attention sources (the owning features' own lists). */
  attention(): Promise<{
    overdueHandovers: { count: number; examples: string[] };
    escalatedReturns: { count: number; examples: string[] };
  }>;
  now: () => Date;
}

const pct = (n: number | null) => (n === null ? "n/a" : `${(n * 100).toFixed(1)}%`);

export function createMetricsService(deps: MetricsDeps) {
  const { repo } = deps;

  async function dashboard(days: number): Promise<MetricsDashboard> {
    const now = deps.now();
    const win: Window = lastDays(now, days);
    const active = rolling(now, ACTIVE_SHOP_DAYS);
    const prior = { from: new Date(now.getTime() - 2 * RETENTION_WINDOW_DAYS * 86_400_000), to: new Date(now.getTime() - RETENTION_WINDOW_DAYS * 86_400_000) };
    const buyerWin = rolling(now, REPEAT_BUYER_DAYS);

    const [approved, live, activeShops, earlierShops, placed, customerOrders, refused, delivered, buyers, openCarts, handover, returns, complaints, reviews, attention] =
      await Promise.all([
        repo.countApprovedShops(),
        repo.countLiveListings(now),
        repo.shopsWithOrders(active.from, active.to),
        repo.shopsWithOrders(prior.from, prior.to),
        repo.countShopOrdersPlaced(win.from, win.to),
        repo.countCustomerOrdersPlaced(win.from, win.to),
        repo.countRefused(win.from, win.to),
        repo.deliveredRows(win.from, win.to),
        repo.deliveredBuyers(buyerWin.from, buyerWin.to),
        repo.countOpenCarts(win.from, win.to),
        deps.handoverRate({ shopId: null, from: win.from, to: win.to }, now),
        deps.returnStats({ from: win.from, to: win.to }),
        deps.complaintStats({ from: win.from, to: win.to, now }),
        deps.reviewMetrics({ from: win.from, to: win.to }),
        deps.attention(),
      ]);

    const byDay = gmvByDay(delivered, win);
    const gmvTotal = sumGmv(byDay);
    const cod = codSuccessRate(delivered.length, refused);
    const refusal = refusalRate(refused, placed);
    const repeat = repeatBuyers(buyers);
    const retention = sellerRetention(earlierShops, activeShops);
    const cart = cartToOrderProxy(customerOrders, openCarts);
    const complaintRate = complaints.closed > 0 ? complaints.closedOnTimeRate : null;
    const label = `last ${days} days`;

    const tile = (key: string, name: string, value: number | null, format: TileFormat, target: number | null, detail: string): Tile => ({
      key,
      label: name,
      value,
      format,
      target,
      status: targetStatus(value, target),
      detail,
    });

    const tiles: Tile[] = [
      tile("active-shops", "Active shops", activeShops.size, "count", TARGETS.activeShops, `Approved shops with at least one order in the last ${ACTIVE_SHOP_DAYS} days (${approved} approved in all).`),
      tile("live-listings", "Live listings", live, "count", TARGETS.liveListings, "Active products of approved shops that can be bought today (now)."),
      tile("gmv", "GMV", gmvTotal, "money", null, `Sum of delivered shop-order totals, ${label}: ${delivered.length} delivered.`),
      tile("orders-placed", "Orders placed", placed, "count", null, `Shop orders placed, ${label} (${customerOrders} customer orders).`),
      tile("orders-delivered", "Orders delivered", delivered.length, "count", null, `Shop orders delivered, ${label}.`),
      tile("orders-refused", "Orders refused", refused, "count", null, `Parcels the customer refused at the door, ${label}.`),
      tile("cod-success", "COD delivery success", cod, "percent", TARGETS.codDeliverySuccess, `Delivered / (delivered + refused), ${label}.`),
      tile("refusal-rate", "Refusal rate", refusal, "percent", null, `Refused / shop orders placed, ${label}.`),
      tile("repeat-buyers", "Repeat buyers", repeat.share, "percent", TARGETS.repeatBuyerShare, `${repeat.repeat} of ${repeat.buyers} buyers (verified phone) have two or more delivered orders in the last ${REPEAT_BUYER_DAYS} days.`),
      tile("seller-retention", "Seller retention", retention.rate, "percent", TARGETS.sellerRetention, `${retention.kept} of ${retention.base} shops that ordered in the earlier ${RETENTION_WINDOW_DAYS} days also ordered in the latest ${RETENTION_WINDOW_DAYS}.`),
      tile("cart-to-order", "Cart-to-order rate (proxy)", cart, "percent", TARGETS.cartToOrder, `Customer orders / (orders + open carts started), ${label}. A proxy: carts keep no history once checked out.`),
      tile("handover", "Handed over within 48 h", handover.rate, "percent", TARGETS.handoverRate, `Of ${handover.eligible} shop orders past their deadline or handed over, ${label}.`),
      tile("complaints", "Complaints resolved within 72 h", complaintRate, "percent", TARGETS.complaintsResolved, `${complaints.closed} of ${complaints.opened} complaints opened in the ${label} are resolved; ${pct(complaintRate)} of them in time.`),
      tile("rating", "Average rating", reviews.averageRating, "rating", null, `Visible reviews written in the ${label} (${reviews.visible}).`),
      tile("return-rate", "Return rate", returns.deliveredShopOrders ? returns.returnRate : null, "percent", null, `Delivered shop orders with an accepted return, ${label}.`),
    ];

    const perShop = new Map<string, { gmvPaisa: number; orders: number }>();
    for (const r of delivered) {
      const e = perShop.get(r.shopId) ?? { gmvPaisa: 0, orders: 0 };
      e.gmvPaisa += Math.round(r.total * 100);
      e.orders++;
      perShop.set(r.shopId, e);
    }
    const top = [...perShop].sort((a, b) => b[1].gmvPaisa - a[1].gmvPaisa).slice(0, 5);
    const names = await repo.shopNames(top.map(([id]) => id));
    const topShops = top.map(([shopId, e]) => ({ shopId, name: names.get(shopId) ?? "Unknown shop", gmv: e.gmvPaisa / 100, orders: e.orders }));

    return {
      generatedAt: now.toISOString(),
      days,
      from: win.from.toISOString(),
      to: win.to.toISOString(),
      tiles,
      gmv: { total: gmvTotal, orders: delivered.length, byDay },
      topShops,
      attention: [
        { label: "Overdue handovers", count: attention.overdueHandovers.count, href: "/admin/orders?overdue=1", examples: attention.overdueHandovers.examples },
        { label: "Escalated returns", count: attention.escalatedReturns.count, href: "/admin/returns", examples: attention.escalatedReturns.examples },
        { label: "Overdue complaints", count: complaints.overdueNow, href: "/admin/complaints", examples: [] },
      ],
    };
  }

  // ---------- Seller performance score (US-059) ----------

  /** Gather one shop's facts over the score window from the owning features. */
  async function scoreInputs(shopId: string, now: Date, counts?: { delivered: number; refused: number }): Promise<ScoreInputs> {
    const win = rolling(now, SCORE_WINDOW_DAYS);
    const [outcome, handover, returns, complaints, rating] = await Promise.all([
      counts ? Promise.resolve(counts) : repo.outcomeCountsByShop(win.from, win.to).then((m) => m.get(shopId) ?? { delivered: 0, refused: 0 }),
      deps.handoverRate({ shopId, from: win.from, to: win.to }, now),
      deps.returnStats({ shopId, from: win.from, to: win.to }),
      deps.complaintStats({ shopId, from: win.from, to: win.to, now }),
      deps.shopRating(shopId, { from: win.from, to: win.to }),
    ]);
    return {
      deliveredOrders: outcome.delivered,
      handoverRate: handover.rate,
      refusalRate: ratio(outcome.refused, outcome.delivered + outcome.refused),
      returnRate: returns.deliveredShopOrders > 0 ? returns.returnRate : null,
      complaintOnTimeRate: complaints.closed > 0 ? complaints.closedOnTimeRate : null,
      averageRating: rating.count > 0 ? rating.average : null,
    };
  }

  /** The live score with its breakdown (seller dashboard; call after the shop guard). */
  async function shopScore(shopId: string): Promise<SellerScore> {
    return computeSellerScore(await scoreInputs(shopId, deps.now()));
  }

  /** Recompute and store every approved shop's score (the daily job). Failures are collected. */
  async function refreshAll(): Promise<{ shops: number; scored: number; failures: { shopId: string; message: string }[] }> {
    const now = deps.now();
    const win = rolling(now, SCORE_WINDOW_DAYS);
    const [ids, counts] = await Promise.all([repo.approvedShopIds(), repo.outcomeCountsByShop(win.from, win.to)]);
    const rows: { shopId: string; score: number | null }[] = [];
    const failures: { shopId: string; message: string }[] = [];
    for (const shopId of ids) {
      try {
        const inputs = await scoreInputs(shopId, now, counts.get(shopId) ?? { delivered: 0, refused: 0 });
        rows.push({ shopId, score: computeSellerScore(inputs).score });
      } catch (err) {
        failures.push({ shopId, message: err instanceof Error ? err.message : String(err) });
      }
    }
    await repo.saveScores(rows, now);
    return { shops: ids.length, scored: rows.filter((r) => r.score !== null).length, failures };
  }

  /** Recompute and store one shop's score (on demand). */
  async function refreshShop(shopId: string): Promise<SellerScore> {
    const now = deps.now();
    const result = computeSellerScore(await scoreInputs(shopId, now));
    await repo.saveScores([{ shopId, score: result.score }], now);
    return result;
  }

  return { dashboard, shopScore, refreshAll, refreshShop };
}

export type MetricsService = ReturnType<typeof createMetricsService>;

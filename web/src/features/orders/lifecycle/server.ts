import { currentUserOrNull } from "@/features/cart/server";
import { recordCollectionOnDelivery } from "@/features/payouts/server";
import { notifyProductsChanged } from "@/features/search";
import { requirePlatformAdmin, requireShopRole } from "@/lib/auth";
import { sendJob } from "@/lib/jobs/boss";
import { appUrl, sendMail } from "@/lib/mail";
import { createSmsProvider } from "@/lib/sms";
import { viewableOrder } from "../server";
import { formatDhakaTime } from "../views";
import { createLifecycleApi } from "./api";
import { computeHandoverRate, runHandoverCheck, sendOverdueAlert } from "./handover";
import type { ShopOrderStatus } from "../config";
import { loadLifecycleConfig, shopActor } from "./machine";
import * as repo from "./repo";
import { createLifecycleService, type ShopOrderTransitionEvent, type TransitionAfterHook, type TransitionTxHook } from "./service";
import { parseFilters, toDetailView, toListView } from "./views";

/**
 * The order lifecycle wired to Prisma, the guards, jobs, SMS and email.
 *
 * Other features plug in here:
 * - TX_HOOKS run inside the status-change transaction (a throw rolls it back). The payout ledger
 *   records the COD collection when a shop order is delivered.
 * - AFTER_HOOKS run after the commit and never block a change (search re-index after a restock,
 *   the customer's SMS). Reviews (US-055) and returns (US-070) can react to "delivered" here.
 * - `lifecycle.asSystem(id, "mark_returned", { restock })` is how the returns flow closes a
 *   delivered shop order; a courier feed would call `asSystem(id, "deliver" | "refuse")`.
 */

export const lifecycleConfig = loadLifecycleConfig();

const TX_HOOKS: TransitionTxHook<repo.Tx>[] = [recordCollectionOnDelivery];

const sms = () => createSmsProvider();

/** Tells the customer when the parcel leaves the shop or the shop cancels. */
async function smsCustomer(event: ShopOrderTransitionEvent): Promise<void> {
  const cancelledByOthers = event.action === "cancel" && event.actorRole !== "customer";
  if (event.action !== "hand_over" && !cancelledByOthers) return;
  const contact = await repo.orderContact(event.orderId);
  if (!contact) return;
  const text =
    event.action === "hand_over"
      ? `Your order ${event.shopOrderNo} is with the courier (${event.note ?? ""}). Pay cash on delivery. Track: ${appUrl(`/track?orderNo=${event.orderNo}`)}`
      : `Your order ${event.shopOrderNo} was cancelled: ${event.note ?? "no reason given"}. Nothing to pay.`;
  await sms().send(contact.contactPhone, text);
}

const AFTER_HOOKS: TransitionAfterHook[] = [
  (event) => {
    if (event.restockedProductIds.length) notifyProductsChanged(event.restockedProductIds);
  },
  smsCustomer,
];

export const lifecycle = createLifecycleService<repo.Tx>({
  store: repo.lifecycleStore,
  config: lifecycleConfig,
  now: () => new Date(),
  txHooks: TX_HOOKS,
  afterHooks: AFTER_HOOKS,
});

export const lifecycleApi = createLifecycleApi({
  requireShop: (shopId) => requireShopRole(shopId, ["owner", "staff"]),
  requireAdmin: requirePlatformAdmin,
  viewableOrder,
  currentUserId: async () => (await currentUserOrNull())?.id ?? null,
  service: lifecycle,
  config: lifecycleConfig,
  now: () => new Date(),
  reads: repo,
});

/** The orders.handover-check job (every 15 minutes). */
export function checkHandovers(now = new Date()) {
  return runHandoverCheck(now, {
    findNewlyOverdue: repo.findNewlyOverdue,
    // Retried with backoff until every channel went out.
    enqueueAlert: (shopOrderId) => sendJob("orders.notify-overdue", { shopOrderId }, { retryLimit: 6, retryDelay: 120, retryBackoff: true }),
    markNotified: repo.markOverdueNotified,
  });
}

/** The orders.notify-overdue job: shop owner/staff by email + SMS, admins by email. */
export function notifyOverdue(shopOrderId: string) {
  const provider = sms();
  return sendOverdueAlert(shopOrderId, {
    load: repo.overdueAlertFacts,
    sendMail,
    sendSms: (phone, text) => provider.send(phone, text),
    sellerUrl: (shopId, id) => appUrl(`/seller/${shopId}/orders/${id}`),
    adminUrl: () => appUrl("/admin/orders?overdue=1"),
    formatTime: (d) => formatDhakaTime(d.toISOString()),
  });
}

/**
 * Handover-rate metric (share handed over within 48 h; plan target ≥ 95%) for one shop or the
 * whole platform, over shop orders placed in [from, to). For seller scores (US-059) and reports (US-083).
 */
export async function handoverRate(scope: { shopId: string | null; from: Date; to: Date }, now = new Date()) {
  return computeHandoverRate(await repo.handoverFacts(scope), now);
}

/** Timelines of a customer order's shop orders (call with an order the viewer may see). */
export async function orderTimelines(orderId: string) {
  return repo.timelinesForOrder(orderId);
}

/** Pages: a shop's orders (guard-checked shopId), or every shop's for the admin (shopId null). */
export async function shopOrderList(shopId: string | null, filters: { status?: ShopOrderStatus; overdue: boolean; shopId?: string }) {
  const now = new Date();
  const [rows, overdueCount] = await Promise.all([
    shopId ? repo.listForShop(shopId, filters, now) : repo.listForAdmin(filters, now),
    repo.countOverdue(shopId, now),
  ]);
  return { orders: rows.map((r) => toListView(r, now)), overdueCount };
}

/** Pages: one shop order for a member of its shop (null for another shop's), or for the admin. */
export async function shopOrderDetail(scope: { shopId: string; role: "owner" | "staff" } | "admin", shopOrderId: string) {
  const row = scope === "admin" ? await repo.getDetailForAdmin(shopOrderId) : await repo.getDetailForShop(scope.shopId, shopOrderId);
  if (!row) return null;
  return toDetailView(row, new Date(), scope === "admin" ? "admin" : shopActor(scope.role), lifecycleConfig);
}

/** Pages: list filters from the query string (an unknown status is ignored). */
export function pageFilters(query: Record<string, string | string[] | undefined>) {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const params = { status: one(query.status), overdue: one(query.overdue), shopId: one(query.shopId) };
  try {
    return parseFilters(params);
  } catch {
    return parseFilters({ ...params, status: undefined });
  }
}

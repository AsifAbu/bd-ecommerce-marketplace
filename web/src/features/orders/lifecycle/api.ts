import { OrderError, readJson, respond } from "../errors";
import { computeHandoverRate, type HandoverFacts } from "./handover";
import { parseAction, shopActor, type LifecycleConfig } from "./machine";
import type { LifecycleService, ShopOrderTransitionEvent } from "./service";
import { parseFilters, toDetailView, toListView, type DetailRowLike, type ListRowLike } from "./views";

/**
 * JSON API of the order lifecycle (US-053; standard error shape `{ error: { code, message, fields? } }`):
 *
 *   GET  /api/shops/[shopId]/orders?status=&overdue=1          owner/staff -> { shopOrders, overdueCount }
 *   GET  /api/shops/[shopId]/orders/[shopOrderId]               owner/staff -> { shopOrder } (timeline + allowed actions)
 *   POST /api/shops/[shopId]/orders/[shopOrderId]/status        owner/staff { action, reason?, courierName?, trackingNo? } -> { shopOrder, event }
 *   POST /api/orders/[orderNo]/shop-orders/[shopOrderId]/cancel the customer (own order or guest grant) { reason? } -> { event }
 *   GET  /api/admin/orders?status=&overdue=1&shopId=            admin -> { shopOrders, overdueCount, handoverRate }
 *   POST /api/admin/orders/[shopOrderId]/status                 admin { action, ... } -> { shopOrder, event }
 *
 * Actions: confirm, pack, hand_over (courierName + trackingNo), deliver, refuse (reason?), cancel
 * (reason; optional for the customer), mark_returned. Errors: 404 NOT_FOUND (also another shop's
 * order), 409 INVALID_TRANSITION / STATUS_CHANGED, 403 FORBIDDEN, 422 VALIDATION.
 */

export interface LifecycleApiDeps {
  requireShop(shopId: string): Promise<{ shopId: string; role: "owner" | "staff"; user: { id: string } }>;
  requireAdmin(): Promise<{ id: string }>;
  /** The order this request may see (own, or a guest grant), or null. */
  viewableOrder(orderNo: string): Promise<{ id: string } | null>;
  currentUserId(): Promise<string | null>;
  service: LifecycleService;
  config: LifecycleConfig;
  now: () => Date;
  reads: {
    listForShop(shopId: string, filters: { status?: string; overdue?: boolean }, now: Date): Promise<ListRowLike[]>;
    listForAdmin(filters: { status?: string; overdue?: boolean; shopId?: string }, now: Date): Promise<ListRowLike[]>;
    getDetailForShop(shopId: string, shopOrderId: string): Promise<DetailRowLike | null>;
    getDetailForAdmin(shopOrderId: string): Promise<DetailRowLike | null>;
    countOverdue(shopId: string | null, now: Date): Promise<number>;
    handoverFacts(scope: { shopId: string | null; from: Date; to: Date }): Promise<HandoverFacts[]>;
  };
}

const query = (req: Request) => Object.fromEntries(new URL(req.url).searchParams);
const eventView = (e: ShopOrderTransitionEvent) => ({
  shopOrderId: e.shopOrderId,
  shopOrderNo: e.shopOrderNo,
  action: e.action,
  from: e.from,
  to: e.to,
  at: e.at.toISOString(),
  actorRole: e.actorRole,
  note: e.note,
  restocked: e.restocked,
});

const DAY_MS = 24 * 3_600_000;

export function createLifecycleApi(deps: LifecycleApiDeps) {
  const notFound = () => new OrderError(404, "NOT_FOUND", "Order not found");

  return {
    listShop: (req: Request, shopId: string) =>
      respond(async () => {
        const access = await deps.requireShop(shopId);
        const filters = parseFilters(query(req));
        const now = deps.now();
        const [rows, overdueCount] = await Promise.all([deps.reads.listForShop(access.shopId, filters, now), deps.reads.countOverdue(access.shopId, now)]);
        return { shopOrders: rows.map((r) => toListView(r, now)), overdueCount };
      }),

    getShop: (shopId: string, shopOrderId: string) =>
      respond(async () => {
        const access = await deps.requireShop(shopId);
        const row = await deps.reads.getDetailForShop(access.shopId, shopOrderId);
        if (!row) throw notFound();
        return { shopOrder: toDetailView(row, deps.now(), shopActor(access.role), deps.config) };
      }),

    transitionShop: (req: Request, shopId: string, shopOrderId: string) =>
      respond(async () => {
        const access = await deps.requireShop(shopId);
        const body = await readJson(req);
        const event = await deps.service.asShop({ shopId: access.shopId, role: access.role, userId: access.user.id }, shopOrderId, parseAction(body.action), body);
        const row = await deps.reads.getDetailForShop(access.shopId, shopOrderId);
        return { shopOrder: row ? toDetailView(row, deps.now(), shopActor(access.role), deps.config) : null, event: eventView(event) };
      }),

    cancelAsCustomer: (req: Request, orderNo: string, shopOrderId: string) =>
      respond(async () => {
        const body = await readJson(req);
        const order = await deps.viewableOrder(orderNo.toUpperCase());
        const event = await deps.service.cancelAsCustomer(order, await deps.currentUserId(), shopOrderId, body.reason);
        return { event: eventView(event) };
      }),

    listAdmin: (req: Request) =>
      respond(async () => {
        await deps.requireAdmin();
        const filters = parseFilters(query(req));
        const now = deps.now();
        const [rows, overdueCount, facts] = await Promise.all([
          deps.reads.listForAdmin(filters, now),
          deps.reads.countOverdue(null, now),
          deps.reads.handoverFacts({ shopId: filters.shopId ?? null, from: new Date(now.getTime() - 30 * DAY_MS), to: now }),
        ]);
        return { shopOrders: rows.map((r) => toListView(r, now)), overdueCount, handoverRate: computeHandoverRate(facts, now) };
      }),

    transitionAdmin: (req: Request, shopOrderId: string) =>
      respond(async () => {
        const admin = await deps.requireAdmin();
        const body = await readJson(req);
        const event = await deps.service.asAdmin(admin.id, shopOrderId, parseAction(body.action), body);
        const row = await deps.reads.getDetailForAdmin(shopOrderId);
        return { shopOrder: row ? toDetailView(row, deps.now(), "admin", deps.config) : null, event: eventView(event) };
      }),
  };
}

export type LifecycleApi = ReturnType<typeof createLifecycleApi>;

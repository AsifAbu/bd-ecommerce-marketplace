import { jsonRoute, readBody } from "@/lib/route-json";
import { ReturnError } from "./errors";
import type { PhotoFile } from "./photos";
import { RETURN_STATUSES, type ReturnStatus } from "./rules";
import type { ReturnScope, ReturnsService } from "./service";
import { toReturnView, type ReturnRowLike, type ReturnView } from "./views";

/**
 * JSON API of returns (US-070, US-071). Standard error shape `{ error: { code, message, fields? } }`.
 *
 *   POST  /api/returns                         customer or guest with the order open: { orderNo, orderItemId, quantity, reason, details? }
 *                                              (JSON, or multipart with up to 4 `photos`) -> 201 { return, warning }
 *   GET   /api/returns                         logged in: { returns } of the user's orders
 *   GET   /api/returns?orderNo=…               the customer's (or grant holder's) requests on that order
 *   PATCH /api/returns/[returnId]              customer: { action: "cancel" } | { action: "dispute", note }
 *   GET   /api/shops/[shopId]/returns?status=  shop owner or staff
 *   PATCH /api/shops/[shopId]/returns/[id]     { action: "accept", note? } | { action: "reject", note } | { action: "receive", restock }
 *                                              | { action: "refund", method, reference, amount, restock? }
 *   GET   /api/admin/returns?status=           Platform Admin (escalated by default)
 *   PATCH /api/admin/returns/[id]              { action: "approve" | "deny", note } | receive | refund
 *
 * Scope comes from the session and the order grant, never from the body (ADR-004).
 */

export interface ReturnsApiDeps {
  currentUserId(): Promise<string | null>;
  /** The order this request may open (own order, or a guest grant); null otherwise. */
  customerOrder(orderNo: string): Promise<{ id: string; orderNo: string } | null>;
  /** Throws 401/403 unless the user is owner or staff of the shop. */
  requireShop(shopId: string): Promise<{ shopId: string; userId: string }>;
  /** Throws 401/403 unless the user is a Platform Admin. */
  requireAdmin(): Promise<{ id: string }>;
  service: Pick<ReturnsService, "request" | "cancel" | "dispute" | "accept" | "reject" | "decide" | "receive" | "refund">;
  rows: {
    forUser(userId: string): Promise<ReturnRowLike[]>;
    forOrder(orderId: string): Promise<ReturnRowLike[]>;
    forShop(shopId: string, status?: ReturnStatus): Promise<ReturnRowLike[]>;
    forAdmin(status?: ReturnStatus): Promise<ReturnRowLike[]>;
    get(scope: ReturnScope, id: string): Promise<ReturnRowLike | null>;
    orderNoOf(id: string): Promise<string | null>;
  };
  now(): Date;
}

const toPhoto = (f: File): PhotoFile => ({ name: f.name, type: f.type, size: f.size, bytes: async () => new Uint8Array(await f.arrayBuffer()) });

function statusParam(url: string): ReturnStatus | undefined {
  const s = new URL(url).searchParams.get("status");
  if (!s) return undefined;
  if (!(RETURN_STATUSES as readonly string[]).includes(s)) throw new ReturnError(422, "VALIDATION", "Unknown status", { status: "Unknown status" });
  return s as ReturnStatus;
}

export function createReturnsApi(deps: ReturnsApiDeps) {
  const view = (rows: ReturnRowLike[]): ReturnView[] => rows.map((r) => toReturnView(r, deps.now()));

  async function one(scope: ReturnScope, id: string): Promise<ReturnView> {
    const row = await deps.rows.get(scope, id);
    if (!row) throw new ReturnError(404, "NOT_FOUND", "Return request not found");
    return toReturnView(row, deps.now());
  }

  /** The order scope of a request, if this browser may open its order (else 404, nothing leaks). */
  async function customerScope(id: string): Promise<ReturnScope> {
    const orderNo = await deps.rows.orderNoOf(id);
    const order = orderNo ? await deps.customerOrder(orderNo) : null;
    if (!order) throw new ReturnError(404, "NOT_FOUND", "Return request not found");
    return { kind: "order", orderId: order.id };
  }

  async function staffAction(scope: ReturnScope, actorId: string, id: string, body: Record<string, unknown>, admin: boolean) {
    const action = body.action;
    if (action === "receive") return deps.service.receive(scope, actorId, id, body.restock);
    if (action === "refund") return deps.service.refund(scope, actorId, id, { method: body.method, reference: body.reference, amount: body.amount, restock: body.restock });
    if (!admin && action === "accept") return deps.service.accept((scope as { shopId: string }).shopId, actorId, id, body.note);
    if (!admin && action === "reject") return deps.service.reject((scope as { shopId: string }).shopId, actorId, id, body.note);
    if (admin && (action === "approve" || action === "deny")) return deps.service.decide(actorId, id, action, body.note);
    const allowed = admin ? '"approve", "deny", "receive" or "refund"' : '"accept", "reject", "receive" or "refund"';
    throw new ReturnError(422, "VALIDATION", `Send action ${allowed}`, { action: `Use ${allowed}` });
  }

  return {
    create: (req: Request) =>
      jsonRoute(
        async () => {
          const { fields, files } = await readBody(req, { allowMultipart: true });
          const order = typeof fields.orderNo === "string" ? await deps.customerOrder(fields.orderNo.trim().toUpperCase()) : null;
          if (!order) throw new ReturnError(404, "NOT_FOUND", "Order not found");
          const result = await deps.service.request(order.id, await deps.currentUserId(), {
            orderItemId: fields.orderItemId,
            quantity: fields.quantity,
            reason: fields.reason,
            details: fields.details,
            photos: (files.photos ?? []).map(toPhoto),
          });
          return { return: await one({ kind: "order", orderId: order.id }, result.id), warning: result.warning };
        },
        201,
        "returns",
      ),

    list: (req: Request) =>
      jsonRoute(async () => {
        const orderNo = new URL(req.url).searchParams.get("orderNo");
        if (orderNo) {
          const order = await deps.customerOrder(orderNo.trim().toUpperCase());
          if (!order) throw new ReturnError(404, "NOT_FOUND", "Order not found");
          return { returns: view(await deps.rows.forOrder(order.id)) };
        }
        const userId = await deps.currentUserId();
        if (!userId) throw new ReturnError(401, "UNAUTHORIZED", "Login required");
        return { returns: view(await deps.rows.forUser(userId)) };
      }, 200, "returns"),

    customerUpdate: (req: Request, id: string) =>
      jsonRoute(async () => {
        const scope = await customerScope(id);
        const { fields } = await readBody(req);
        const actor = await deps.currentUserId();
        if (fields.action === "cancel") await deps.service.cancel(scope, actor, id);
        else if (fields.action === "dispute") await deps.service.dispute(scope, actor, id, fields.note);
        else throw new ReturnError(422, "VALIDATION", 'Send action "cancel" or "dispute"', { action: 'Use "cancel" or "dispute"' });
        return { return: await one(scope, id) };
      }, 200, "returns"),

    shopList: (req: Request, shopId: string) =>
      jsonRoute(async () => {
        const access = await deps.requireShop(shopId);
        return { returns: view(await deps.rows.forShop(access.shopId, statusParam(req.url))) };
      }, 200, "returns"),

    shopUpdate: (req: Request, shopId: string, id: string) =>
      jsonRoute(async () => {
        const access = await deps.requireShop(shopId);
        const scope: ReturnScope = { kind: "shop", shopId: access.shopId };
        await staffAction(scope, access.userId, id, (await readBody(req)).fields, false);
        return { return: await one(scope, id) };
      }, 200, "returns"),

    adminList: (req: Request) =>
      jsonRoute(async () => {
        await deps.requireAdmin();
        return { returns: view(await deps.rows.forAdmin(statusParam(req.url))) };
      }, 200, "returns"),

    adminUpdate: (req: Request, id: string) =>
      jsonRoute(async () => {
        const admin = await deps.requireAdmin();
        await staffAction({ kind: "admin" }, admin.id, id, (await readBody(req)).fields, true);
        return { return: await one({ kind: "admin" }, id) };
      }, 200, "returns"),
  };
}

export type ReturnsApi = ReturnType<typeof createReturnsApi>;

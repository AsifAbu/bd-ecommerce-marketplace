import { jsonRoute, readBody } from "@/lib/route-json";
import { COMPLAINT_STATUSES, ComplaintError, type ComplaintStatus } from "./rules";
import type { ComplaintScope, ComplaintsService } from "./service";
import { sortForQueue, toTicketView, type TicketRowLike, type TicketView } from "./views";

/**
 * JSON API of complaints (US-072). Standard error shape `{ error: { code, message, fields? } }`.
 *
 *   POST  /api/complaints                         customer or guest with the order open:
 *                                                 { orderNo, shopOrderId?, subject, category, message } -> 201 { complaint }
 *   GET   /api/complaints                         logged in: { complaints } on the user's orders
 *   GET   /api/complaints?orderNo=…               tickets on that order (customer or grant holder)
 *   GET   /api/complaints/[id]                    one ticket with its thread (customer)
 *   POST  /api/complaints/[id]/messages           customer reply { text }
 *   GET   /api/shops/[shopId]/complaints          shop owner or staff: tickets about the shop's orders
 *   GET   /api/shops/[shopId]/complaints/[id]     one ticket with its thread
 *   POST  /api/shops/[shopId]/complaints/[id]     shop reply { text }
 *   GET   /api/admin/complaints?status=           Platform Admin queue (active by due time by default)
 *   PATCH /api/admin/complaints/[id]              { action: "reply", text } | { action: "start" }
 *                                                 | { action: "resolve" | "close", resolution }
 */

export interface ComplaintsApiDeps {
  currentUserId(): Promise<string | null>;
  customerOrder(orderNo: string): Promise<{ id: string; orderNo: string } | null>;
  requireShop(shopId: string): Promise<{ shopId: string; userId: string }>;
  requireAdmin(): Promise<{ id: string }>;
  service: Pick<ComplaintsService, "open" | "reply" | "adminUpdate">;
  rows: {
    forUser(userId: string): Promise<TicketRowLike[]>;
    forOrder(orderId: string): Promise<TicketRowLike[]>;
    forShop(shopId: string): Promise<TicketRowLike[]>;
    forAdmin(statuses?: readonly ComplaintStatus[]): Promise<TicketRowLike[]>;
    detail(scope: ComplaintScope, id: string): Promise<TicketRowLike | null>;
    orderNoOf(id: string): Promise<string | null>;
  };
  now(): Date;
}

export function createComplaintsApi(deps: ComplaintsApiDeps) {
  const views = (rows: TicketRowLike[]): TicketView[] => rows.map((r) => toTicketView(r, deps.now()));

  async function detail(scope: ComplaintScope, id: string): Promise<TicketView> {
    const row = await deps.rows.detail(scope, id);
    if (!row) throw new ComplaintError(404, "NOT_FOUND", "Complaint not found");
    return toTicketView(row, deps.now());
  }

  async function customerScope(id: string): Promise<ComplaintScope> {
    const orderNo = await deps.rows.orderNoOf(id);
    const order = orderNo ? await deps.customerOrder(orderNo) : null;
    if (!order) throw new ComplaintError(404, "NOT_FOUND", "Complaint not found");
    return { kind: "order", orderId: order.id };
  }

  return {
    create: (req: Request) =>
      jsonRoute(
        async () => {
          const { fields } = await readBody(req);
          const order = typeof fields.orderNo === "string" ? await deps.customerOrder(fields.orderNo.trim().toUpperCase()) : null;
          if (!order) throw new ComplaintError(404, "NOT_FOUND", "Order not found");
          const ticket = await deps.service.open(order.id, await deps.currentUserId(), fields);
          return { complaint: await detail({ kind: "order", orderId: order.id }, ticket.id) };
        },
        201,
        "complaints",
      ),

    list: (req: Request) =>
      jsonRoute(async () => {
        const orderNo = new URL(req.url).searchParams.get("orderNo");
        if (orderNo) {
          const order = await deps.customerOrder(orderNo.trim().toUpperCase());
          if (!order) throw new ComplaintError(404, "NOT_FOUND", "Order not found");
          return { complaints: views(await deps.rows.forOrder(order.id)) };
        }
        const userId = await deps.currentUserId();
        if (!userId) throw new ComplaintError(401, "UNAUTHORIZED", "Login required");
        return { complaints: views(await deps.rows.forUser(userId)) };
      }, 200, "complaints"),

    get: (id: string) => jsonRoute(async () => ({ complaint: await detail(await customerScope(id), id) }), 200, "complaints"),

    customerReply: (req: Request, id: string) =>
      jsonRoute(async () => {
        const scope = await customerScope(id);
        const { fields } = await readBody(req);
        await deps.service.reply(scope, { role: "customer", id: await deps.currentUserId() }, id, fields.text);
        return { complaint: await detail(scope, id) };
      }, 201, "complaints"),

    shopList: (shopId: string) =>
      jsonRoute(async () => {
        const access = await deps.requireShop(shopId);
        return { complaints: views(await deps.rows.forShop(access.shopId)) };
      }, 200, "complaints"),

    shopGet: (shopId: string, id: string) =>
      jsonRoute(async () => {
        const access = await deps.requireShop(shopId);
        return { complaint: await detail({ kind: "shop", shopId: access.shopId }, id) };
      }, 200, "complaints"),

    shopReply: (req: Request, shopId: string, id: string) =>
      jsonRoute(async () => {
        const access = await deps.requireShop(shopId);
        const scope: ComplaintScope = { kind: "shop", shopId: access.shopId };
        const { fields } = await readBody(req);
        await deps.service.reply(scope, { role: "shop", id: access.userId }, id, fields.text);
        return { complaint: await detail(scope, id) };
      }, 201, "complaints"),

    adminList: (req: Request) =>
      jsonRoute(async () => {
        await deps.requireAdmin();
        const s = new URL(req.url).searchParams.get("status");
        if (s && !(COMPLAINT_STATUSES as readonly string[]).includes(s)) throw new ComplaintError(422, "VALIDATION", "Unknown status", { status: "Unknown status" });
        return { complaints: sortForQueue(views(await deps.rows.forAdmin(s ? [s as ComplaintStatus] : undefined))) };
      }, 200, "complaints"),

    adminGet: (id: string) =>
      jsonRoute(async () => {
        await deps.requireAdmin();
        return { complaint: await detail({ kind: "admin" }, id) };
      }, 200, "complaints"),

    adminUpdate: (req: Request, id: string) =>
      jsonRoute(async () => {
        const admin = await deps.requireAdmin();
        const { fields } = await readBody(req);
        if (fields.action === "reply") await deps.service.reply({ kind: "admin" }, { role: "admin", id: admin.id }, id, fields.text);
        else if (fields.action === "start" || fields.action === "resolve" || fields.action === "close") await deps.service.adminUpdate(admin.id, id, fields.action, fields.resolution);
        else throw new ComplaintError(422, "VALIDATION", 'Send action "reply", "start", "resolve" or "close"', { action: 'Use "reply", "start", "resolve" or "close"' });
        return { complaint: await detail({ kind: "admin" }, id) };
      }, 200, "complaints"),
  };
}

export type ComplaintsApi = ReturnType<typeof createComplaintsApi>;

import { describe, expect, it, vi } from "vitest";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";
import { createComplaintsApi, type ComplaintsApiDeps } from "./api";
import type { ComplaintScope } from "./service";
import type { TicketRowLike } from "./views";

// Complaints API scoping: customers (account or guest with the order grant) only on their orders,
// shops only tickets about their own shop orders, the admin via requirePlatformAdmin.

const t = (id: string, orderId: string, shopId: string | null): TicketRowLike & { orderId: string } => ({
  id,
  orderId,
  ticketNo: `CP-261015-${id.toUpperCase()}`,
  subject: "Parcel not delivered",
  category: "delivery",
  status: "open",
  statusChangedAt: new Date("2026-10-15T00:00:00Z"),
  dueAt: new Date("2026-10-18T00:00:00Z"),
  overdueAt: null,
  resolvedAt: null,
  resolution: null,
  createdAt: new Date("2026-10-15T00:00:00Z"),
  updatedAt: new Date("2026-10-15T00:00:00Z"),
  shopId,
  order: { orderNo: orderId === "oA" ? "BD-261015-AAAAA" : "BD-261015-BBBBB", contactName: "C" },
  shopOrder: shopId ? { id: `so-${id}`, seq: 1, shopName: shopId } : null,
  messages: [{ id: "m1", authorRole: "customer", text: "Where is it?", createdAt: new Date("2026-10-15T00:00:00Z") }],
});

const ROWS = [t("ta", "oA", "s1"), t("tb", "oB", "s2")];
const inScope = (scope: ComplaintScope, r: (typeof ROWS)[number]) =>
  scope.kind === "order" ? r.orderId === scope.orderId : scope.kind === "shop" ? r.shopId === scope.shopId : true;

function setup(opts: { user?: string | null; grants?: string[]; shops?: Record<string, string[]>; admin?: string } = {}) {
  const user = opts.user ?? null;
  const orders: Record<string, { id: string; owner: string | null }> = { "BD-261015-AAAAA": { id: "oA", owner: "uA" }, "BD-261015-BBBBB": { id: "oB", owner: null } };
  const service = {
    open: vi.fn(async (orderId: string) => ({ id: orderId === "oA" ? "ta" : "tb", ticketNo: "CP" })),
    reply: vi.fn(async () => ({ messageId: "m2", status: "in_progress" as const })),
    adminUpdate: vi.fn(async () => ({ status: "resolved" as const })),
  };
  const deps: ComplaintsApiDeps = {
    currentUserId: async () => user,
    customerOrder: async (no) => {
      const o = orders[no];
      return o && ((user && o.owner === user) || opts.grants?.includes(no)) ? { id: o.id, orderNo: no } : null;
    },
    requireShop: async (shopId) => {
      if (!user) throw new UnauthorizedError();
      if (!opts.shops?.[user]?.includes(shopId)) throw new ForbiddenError("Not allowed for this shop");
      return { shopId, userId: user };
    },
    requireAdmin: async () => {
      if (!user) throw new UnauthorizedError();
      if (user !== opts.admin) throw new ForbiddenError();
      return { id: user };
    },
    service,
    rows: {
      forUser: async (u) => ROWS.filter((r) => orders[r.order!.orderNo].owner === u),
      forOrder: async (orderId) => ROWS.filter((r) => r.orderId === orderId),
      forShop: async (shopId) => ROWS.filter((r) => r.shopId === shopId),
      forAdmin: async () => ROWS,
      detail: async (scope, id) => ROWS.find((r) => r.id === id && inScope(scope, r)) ?? null,
      orderNoOf: async (id) => ROWS.find((r) => r.id === id)?.order?.orderNo ?? null,
    },
    now: () => new Date("2026-10-16T00:00:00Z"),
  };
  return { api: createComplaintsApi(deps), service };
}

const json = (body: unknown, method = "POST") => new Request("http://x", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("customer", () => {
  it("opens a ticket on an own order, or as a guest with the order grant", async () => {
    const own = setup({ user: "uA" });
    const res = await own.api.create(json({ orderNo: "BD-261015-AAAAA", subject: "Parcel", category: "delivery", message: "Where is it?" }));
    expect(res.status).toBe(201);
    expect((await res.json()).complaint.ticketNo).toBe("CP-261015-TA");
    const guest = setup({ grants: ["BD-261015-BBBBB"] });
    expect((await guest.api.create(json({ orderNo: "BD-261015-BBBBB", subject: "Parcel", category: "delivery", message: "Where is it?" }))).status).toBe(201);
    expect(guest.service.open).toHaveBeenCalledWith("oB", null, expect.anything());
  });

  it("can't open or read tickets on someone else's order", async () => {
    const { api, service } = setup({ user: "uA" });
    expect((await api.create(json({ orderNo: "BD-261015-BBBBB", subject: "x", category: "delivery", message: "y" }))).status).toBe(404);
    expect(service.open).not.toHaveBeenCalled();
    expect((await api.get("tb")).status).toBe(404);
    expect((await api.customerReply(json({ text: "hello" }), "tb")).status).toBe(404);
    expect((await api.get("ta")).status).toBe(200);
  });

  it("lists the user's tickets; guests need ?orderNo with a grant", async () => {
    const mine = await (await setup({ user: "uA" }).api.list(new Request("http://x/api/complaints"))).json();
    expect(mine.complaints.map((c: { id: string }) => c.id)).toEqual(["ta"]);
    expect((await setup({}).api.list(new Request("http://x/api/complaints"))).status).toBe(401);
    expect((await setup({ grants: ["BD-261015-BBBBB"] }).api.list(new Request("http://x/api/complaints?orderNo=BD-261015-BBBBB"))).status).toBe(200);
  });
});

describe("shop", () => {
  it("sees and answers only tickets about its own shop orders", async () => {
    const { api, service } = setup({ user: "o1", shops: { o1: ["s1"] } });
    const list = await (await api.shopList("s1")).json();
    expect(list.complaints.map((c: { id: string }) => c.id)).toEqual(["ta"]);
    expect((await api.shopGet("s1", "tb")).status).toBe(404);
    expect((await api.shopList("s2")).status).toBe(403);
    expect((await api.shopReply(json({ text: "hi" }), "s2", "tb")).status).toBe(403);
    await api.shopReply(json({ text: "We are checking." }), "s1", "ta");
    expect(service.reply).toHaveBeenCalledWith({ kind: "shop", shopId: "s1" }, { role: "shop", id: "o1" }, "ta", "We are checking.");
  });
});

describe("admin", () => {
  it("only the Platform Admin reads the queue and resolves", async () => {
    expect((await setup({ user: "uA", admin: "boss" }).api.adminList(new Request("http://x"))).status).toBe(403);
    expect((await setup({}).api.adminList(new Request("http://x"))).status).toBe(401);
    const { api, service } = setup({ user: "boss", admin: "boss" });
    const queue = await (await api.adminList(new Request("http://x/api/admin/complaints"))).json();
    expect(queue.complaints).toHaveLength(2);
    await api.adminUpdate(json({ action: "resolve", resolution: "Refunded by the shop." }, "PATCH"), "ta");
    expect(service.adminUpdate).toHaveBeenCalledWith("boss", "ta", "resolve", "Refunded by the shop.");
    expect((await api.adminUpdate(json({ action: "explode" }, "PATCH"), "ta")).status).toBe(422);
  });
});

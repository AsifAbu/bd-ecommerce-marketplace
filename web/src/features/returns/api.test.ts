import { describe, expect, it, vi } from "vitest";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";
import { createReturnsApi, type ReturnsApiDeps } from "./api";
import type { ReturnScope } from "./service";
import type { ReturnRowLike } from "./views";

// Returns API scoping: a customer only reaches requests on orders it may open (own account order,
// or a guest holding the signed order grant), a shop only its own shop's, the admin via
// requirePlatformAdmin. Errors use the standard shape.

const row = (id: string, orderId: string, shopId: string): ReturnRowLike & { orderId: string } => ({
  id,
  orderId,
  quantity: 1,
  reason: "damaged",
  details: null,
  photoKeys: [],
  policyVersion: 1,
  status: "requested",
  statusChangedAt: new Date("2026-10-12T00:00:00Z"),
  shopDueAt: new Date("2026-10-14T00:00:00Z"),
  shopRespondedAt: null,
  shopNote: null,
  escalatedAt: null,
  escalationReason: null,
  disputeNote: null,
  adminDecidedAt: null,
  adminNote: null,
  receivedAt: null,
  restockedAt: null,
  refundAmount: null,
  refundDelivery: null,
  refundMethod: null,
  refundReference: null,
  refundedAt: null,
  createdAt: new Date("2026-10-12T00:00:00Z"),
  shopId,
  order: { orderNo: orderId === "oA" ? "BD-261010-AAAAA" : "BD-261010-BBBBB", contactName: "C" },
  shopOrder: { id: `so-${orderId}`, seq: 1, shopName: shopId, deliveryCharge: "70.00", deliveredAt: new Date("2026-10-10T00:00:00Z") },
  orderItem: { id: `i-${id}`, title: "Item", variantLabel: null, sku: null, unitPrice: "100.00", quantity: 1 },
});

const ROWS = [row("rA", "oA", "s1"), row("rB", "oB", "s2")];
const inScope = (scope: ReturnScope, r: (typeof ROWS)[number]) =>
  scope.kind === "order" ? r.orderId === scope.orderId : scope.kind === "shop" ? r.shopId === scope.shopId : true;

function setup(opts: { user?: string | null; grants?: string[]; shops?: Record<string, string[]>; admin?: string | null } = {}) {
  const user = opts.user ?? null;
  const orders: Record<string, { id: string; owner: string | null }> = {
    "BD-261010-AAAAA": { id: "oA", owner: "uA" },
    "BD-261010-BBBBB": { id: "oB", owner: null },
  };
  const service = {
    request: vi.fn(async (orderId: string) => ({ id: orderId === "oA" ? "rA" : "rB", warning: null })),
    cancel: vi.fn(async () => {}),
    dispute: vi.fn(async () => {}),
    accept: vi.fn(async () => {}),
    reject: vi.fn(async () => {}),
    decide: vi.fn(async () => {}),
    receive: vi.fn(async () => {}),
    refund: vi.fn(async () => ({ amount: "1.00", delivery: "0.00" })),
  };
  const deps: ReturnsApiDeps = {
    currentUserId: async () => user,
    // Same rule as orders' viewableOrder: own account order, else a grant for that order number.
    customerOrder: async (no) => {
      const o = orders[no];
      if (!o) return null;
      if ((user && o.owner === user) || opts.grants?.includes(no)) return { id: o.id, orderNo: no };
      return null;
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
      forUser: async (u) => ROWS.filter((r) => orders[r.order.orderNo].owner === u),
      forOrder: async (orderId) => ROWS.filter((r) => r.orderId === orderId),
      forShop: async (shopId) => ROWS.filter((r) => r.shopId === shopId),
      forAdmin: async () => ROWS,
      get: async (scope, id) => ROWS.find((r) => r.id === id && inScope(scope, r)) ?? null,
      orderNoOf: async (id) => ROWS.find((r) => r.id === id)?.order.orderNo ?? null,
    },
    now: () => new Date("2026-10-12T06:00:00Z"),
  };
  return { api: createReturnsApi(deps), service };
}

const json = (body: unknown, method = "POST") =>
  new Request("http://x/api/returns", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("customer scope", () => {
  it("creates a return on the user's own order", async () => {
    const { api, service } = setup({ user: "uA" });
    const res = await api.create(json({ orderNo: "bd-261010-aaaaa", orderItemId: "i-rA", quantity: 1, reason: "damaged" }));
    expect(res.status).toBe(201);
    expect(service.request).toHaveBeenCalledWith("oA", "uA", expect.objectContaining({ orderItemId: "i-rA" }));
    expect((await res.json()).return.id).toBe("rA");
  });

  it("refuses another customer's order with 404 and the standard error shape", async () => {
    const { api, service } = setup({ user: "uOther" });
    const res = await api.create(json({ orderNo: "BD-261010-AAAAA", orderItemId: "i-rA", quantity: 1, reason: "damaged" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "NOT_FOUND", message: "Order not found" } });
    expect(service.request).not.toHaveBeenCalled();
  });

  it("lets a guest act only with a valid order grant (order_access cookie)", async () => {
    const withGrant = setup({ grants: ["BD-261010-BBBBB"] });
    expect((await withGrant.api.create(json({ orderNo: "BD-261010-BBBBB", orderItemId: "i-rB", quantity: 1, reason: "damaged" }))).status).toBe(201);
    expect(withGrant.service.request).toHaveBeenCalledWith("oB", null, expect.anything());
    const noGrant = setup({});
    expect((await noGrant.api.create(json({ orderNo: "BD-261010-BBBBB", orderItemId: "i-rB", quantity: 1, reason: "damaged" }))).status).toBe(404);
  });

  it("lists only the user's requests; a guest needs ?orderNo with a grant", async () => {
    const { api } = setup({ user: "uA" });
    const mine = await (await api.list(new Request("http://x/api/returns"))).json();
    expect(mine.returns.map((r: { id: string }) => r.id)).toEqual(["rA"]);
    expect((await setup({}).api.list(new Request("http://x/api/returns"))).status).toBe(401);
    expect((await setup({}).api.list(new Request("http://x/api/returns?orderNo=BD-261010-BBBBB"))).status).toBe(404);
    const guest = await (await setup({ grants: ["BD-261010-BBBBB"] }).api.list(new Request("http://x/api/returns?orderNo=BD-261010-BBBBB"))).json();
    expect(guest.returns.map((r: { id: string }) => r.id)).toEqual(["rB"]);
  });

  it("cancels or disputes only requests on orders the customer may open", async () => {
    const { api, service } = setup({ user: "uA" });
    expect((await api.customerUpdate(json({ action: "cancel" }, "PATCH"), "rA")).status).toBe(200);
    expect(service.cancel).toHaveBeenCalledWith({ kind: "order", orderId: "oA" }, "uA", "rA");
    expect((await api.customerUpdate(json({ action: "cancel" }, "PATCH"), "rB")).status).toBe(404);
    expect(service.cancel).toHaveBeenCalledTimes(1);
  });

  it("requires JSON for writes", async () => {
    const { api } = setup({ user: "uA" });
    const res = await api.customerUpdate(new Request("http://x", { method: "PATCH", headers: { "content-type": "text/plain" }, body: "action=cancel" }), "rA");
    expect(res.status).toBe(415);
  });
});

describe("shop scope (ADR-004)", () => {
  it("lists only its own shop's returns", async () => {
    const { api } = setup({ user: "owner1", shops: { owner1: ["s1"] } });
    const body = await (await api.shopList(new Request("http://x"), "s1")).json();
    expect(body.returns.map((r: { id: string }) => r.id)).toEqual(["rA"]);
  });

  it("refuses another shop with 403 and never calls the service", async () => {
    const { api, service } = setup({ user: "owner1", shops: { owner1: ["s1"] } });
    expect((await api.shopList(new Request("http://x"), "s2")).status).toBe(403);
    expect((await api.shopUpdate(json({ action: "accept" }, "PATCH"), "s2", "rB")).status).toBe(403);
    expect(service.accept).not.toHaveBeenCalled();
  });

  it("passes the guard-checked shop scope to the service; a guest gets 401", async () => {
    const { api, service } = setup({ user: "owner1", shops: { owner1: ["s1"] } });
    await api.shopUpdate(json({ action: "refund", method: "bkash", reference: "TX1", amount: 100 }, "PATCH"), "s1", "rA");
    expect(service.refund).toHaveBeenCalledWith({ kind: "shop", shopId: "s1" }, "owner1", "rA", expect.objectContaining({ method: "bkash", reference: "TX1" }));
    expect((await setup({}).api.shopList(new Request("http://x"), "s1")).status).toBe(401);
  });

  it("a shop can't approve or deny (admin only)", async () => {
    const { api } = setup({ user: "owner1", shops: { owner1: ["s1"] } });
    expect((await api.shopUpdate(json({ action: "approve" }, "PATCH"), "s1", "rA")).status).toBe(422);
  });
});

describe("admin scope", () => {
  it("only the Platform Admin lists and decides escalated returns", async () => {
    expect((await setup({ user: "uA", admin: "boss" }).api.adminList(new Request("http://x"))).status).toBe(403);
    const { api, service } = setup({ user: "boss", admin: "boss" });
    expect((await api.adminList(new Request("http://x/api/admin/returns?status=escalated"))).status).toBe(200);
    expect((await api.adminList(new Request("http://x/api/admin/returns?status=nope"))).status).toBe(422);
    await api.adminUpdate(json({ action: "approve", note: "ok" }, "PATCH"), "rA");
    expect(service.decide).toHaveBeenCalledWith("boss", "rA", "approve", "ok");
  });
});

import { describe, expect, it, vi } from "vitest";
import type { ShopOrderStatus } from "../config";
import { createLifecycleApi, type LifecycleApiDeps } from "./api";
import { createLifecycleService, type LifecycleStore, type LifecycleTarget, type ShopOrderTransitionEvent } from "./service";
import type { DetailRowLike, ListRowLike } from "./views";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";

// The lifecycle service and its JSON API: every entry point is scoped (shop A never reaches shop
// B's orders, a customer only their own order's shop orders, the admin only via the admin guard),
// hooks run, and after-hook failures never undo or block a change.

const NOW = new Date("2026-10-17T06:00:00Z");

const SHOP_ORDERS: LifecycleTarget[] = [
  { id: "soA", shopId: "shopA", orderId: "o1", orderNo: "BD-261017-AAAAA", seq: 1, status: "placed" },
  { id: "soB", shopId: "shopB", orderId: "o1", orderNo: "BD-261017-AAAAA", seq: 2, status: "handed_over" },
  { id: "soX", shopId: "shopA", orderId: "o2", orderNo: "BD-261017-XXXXX", seq: 1, status: "placed" },
];

function fakeStore() {
  const rows = SHOP_ORDERS.map((r) => ({ ...r }));
  const applied: { id: string; to: ShopOrderStatus; actor: string }[] = [];
  const store: LifecycleStore<"tx"> = {
    findForShop: async (shopId, id) => rows.find((r) => r.id === id && r.shopId === shopId) ?? null,
    findForOrder: async (orderId, id) => rows.find((r) => r.id === id && r.orderId === orderId) ?? null,
    findById: async (id) => rows.find((r) => r.id === id) ?? null,
    async apply(target, plan, actor, hooks) {
      const row = rows.find((r) => r.id === target.id)!;
      row.status = plan.to;
      applied.push({ id: target.id, to: plan.to, actor: actor.role });
      const event: ShopOrderTransitionEvent = {
        shopOrderId: target.id,
        shopId: target.shopId,
        orderId: target.orderId,
        orderNo: target.orderNo,
        shopOrderNo: `${target.orderNo}-${target.seq}`,
        action: plan.action,
        from: plan.from,
        to: plan.to,
        at: plan.patch.statusChangedAt,
        actorId: actor.id,
        actorRole: actor.role,
        note: plan.note,
        restocked: plan.restock,
        restockedProductIds: plan.restock ? ["p1"] : [],
      };
      for (const hook of hooks) await hook("tx", event);
      return event;
    },
  };
  return { store, rows, applied };
}

function setup(over: { txHook?: (tx: "tx", e: ShopOrderTransitionEvent) => Promise<void>; after?: (e: ShopOrderTransitionEvent) => void } = {}) {
  const { store, rows, applied } = fakeStore();
  const log = vi.fn();
  const service = createLifecycleService<"tx">({
    store,
    config: { shopMarksDelivery: true },
    now: () => NOW,
    txHooks: over.txHook ? [over.txHook] : [],
    afterHooks: over.after ? [over.after] : [],
    log,
  });
  return { service, rows, applied, log };
}

describe("lifecycle service scoping", () => {
  it("a shop changes only its own shop orders (another shop's is 404)", async () => {
    const { service, rows } = setup();
    await expect(service.asShop({ shopId: "shopA", role: "staff", userId: "u" }, "soB", "deliver")).rejects.toMatchObject({ status: 404 });
    expect(rows.find((r) => r.id === "soB")?.status).toBe("handed_over");
    const event = await service.asShop({ shopId: "shopA", role: "owner", userId: "u" }, "soA", "confirm");
    expect(event).toMatchObject({ to: "confirmed", actorRole: "shop_owner", actorId: "u" });
  });

  it("a customer cancels only a shop order of an order they may see", async () => {
    const { service, rows } = setup();
    await expect(service.cancelAsCustomer(null, null, "soA")).rejects.toMatchObject({ status: 404 });
    await expect(service.cancelAsCustomer({ id: "o1" }, "c1", "soX")).rejects.toMatchObject({ status: 404 });
    expect(rows.find((r) => r.id === "soX")?.status).toBe("placed");
    expect(await service.cancelAsCustomer({ id: "o1" }, "c1", "soA", "Changed my mind")).toMatchObject({ to: "cancelled", actorRole: "customer", note: "Changed my mind" });
  });

  it("checks the rules before writing (customer can't cancel a handed-over order)", async () => {
    const { service, applied } = setup();
    await expect(service.cancelAsCustomer({ id: "o1" }, "c1", "soB")).rejects.toMatchObject({ status: 409, code: "INVALID_TRANSITION" });
    expect(applied).toEqual([]);
  });

  it("the admin and jobs reach any shop order", async () => {
    const { service } = setup();
    expect(await service.asAdmin("admin1", "soB", "refuse", { reason: "Phone off" })).toMatchObject({ to: "refused", actorRole: "admin" });
    expect(await service.asSystem("soB", "mark_returned")).toMatchObject({ to: "returned", restocked: true, actorRole: "system" });
  });
});

describe("hooks", () => {
  it("passes the event to the in-transaction hooks (e.g. the COD collection on delivery)", async () => {
    const txHook = vi.fn(async () => {});
    const { service } = setup({ txHook });
    await service.asShop({ shopId: "shopB", role: "staff", userId: "u" }, "soB", "deliver");
    expect(txHook).toHaveBeenCalledWith("tx", expect.objectContaining({ shopOrderId: "soB", to: "delivered", actorId: "u" }));
  });

  it("logs after-hook failures without failing the change (e.g. SMS down)", async () => {
    const { service, rows, log } = setup({
      after: () => {
        throw new Error("sms down");
      },
    });
    await expect(service.asShop({ shopId: "shopA", role: "staff", userId: "u" }, "soA", "cancel", { reason: "Out of stock" })).resolves.toMatchObject({ to: "cancelled" });
    expect(rows.find((r) => r.id === "soA")?.status).toBe("cancelled");
    expect(log).toHaveBeenCalledOnce();
  });
});

// ---------- JSON API ----------

const listRow = (t: LifecycleTarget): ListRowLike & DetailRowLike => ({
  id: t.id,
  shopId: t.shopId,
  seq: t.seq,
  status: t.status,
  statusChangedAt: NOW,
  shopName: t.shopId,
  itemsSubtotal: "100.00",
  deliveryCharge: "70.00",
  total: "170.00",
  handoverDueAt: new Date(NOW.getTime() - 3_600_000),
  handedOverAt: null,
  overdueNotifiedAt: null,
  courierName: null,
  trackingNo: null,
  freeDelivery: false,
  weightGrams: 500,
  cancelReason: null,
  cancelledBy: null,
  refusalNote: null,
  deliveredAt: null,
  order: { id: t.orderId, orderNo: t.orderNo, contactName: "C", contactPhone: "+8801711111111", zone: "inside_dhaka", address: {}, placedAt: NOW },
  items: [],
  events: [],
});

type Who = { kind: "member"; shopId: string; role: "owner" | "staff" } | { kind: "admin" } | { kind: "customer"; orders: string[] } | { kind: "guest" };

function api(who: Who) {
  const { service, rows } = setup();
  const deps: LifecycleApiDeps = {
    requireShop: async (shopId) => {
      if (who.kind === "guest") throw new UnauthorizedError();
      if (who.kind !== "member" || who.shopId !== shopId) throw new ForbiddenError("Not allowed for this shop");
      return { shopId, role: who.role, user: { id: "member" } };
    },
    requireAdmin: async () => {
      if (who.kind === "guest") throw new UnauthorizedError();
      if (who.kind !== "admin") throw new ForbiddenError();
      return { id: "admin" };
    },
    viewableOrder: async (orderNo) => (who.kind === "customer" && who.orders.includes(orderNo) ? { id: rows.find((r) => r.orderNo === orderNo)!.orderId } : null),
    currentUserId: async () => (who.kind === "customer" ? "c1" : null),
    service,
    config: { shopMarksDelivery: true },
    now: () => NOW,
    reads: {
      listForShop: async (shopId) => rows.filter((r) => r.shopId === shopId).map(listRow),
      listForAdmin: async () => rows.map(listRow),
      getDetailForShop: async (shopId, id) => {
        const r = rows.find((x) => x.id === id && x.shopId === shopId);
        return r ? listRow(r) : null;
      },
      getDetailForAdmin: async (id) => {
        const r = rows.find((x) => x.id === id);
        return r ? listRow(r) : null;
      },
      countOverdue: async (shopId) => rows.filter((r) => (!shopId || r.shopId === shopId) && r.status === "placed").length,
      handoverFacts: async () => [],
    },
  };
  return { api: createLifecycleApi(deps), rows };
}

const post = (body: unknown) => new Request("http://x/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const get = (q = "") => new Request(`http://x/api${q}`);

describe("lifecycle JSON API", () => {
  it("lists only the member's own shop, with overdue and the countdown", async () => {
    const { api: a } = api({ kind: "member", shopId: "shopA", role: "staff" });
    const res = await a.listShop(get("?overdue=1"), "shopA");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shopOrders.map((s: { id: string }) => s.id).sort()).toEqual(["soA", "soX"]);
    expect(body.shopOrders[0]).toMatchObject({ overdue: true, countdown: { state: "overdue" } });
    expect(body.overdueCount).toBe(2);
    expect((await a.listShop(get(), "shopB")).status).toBe(403);
    expect(await (await a.listShop(get("?status=shipped"), "shopA")).json()).toMatchObject({ error: { code: "VALIDATION" } });
  });

  it("shop A can't read or change shop B's order, even by guessing its id under its own shop", async () => {
    const { api: a, rows } = api({ kind: "member", shopId: "shopA", role: "owner" });
    expect((await a.getShop("shopA", "soB")).status).toBe(404);
    const res = await a.transitionShop(post({ action: "deliver" }), "shopA", "soB");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "NOT_FOUND", message: "Order not found" } });
    expect((await a.transitionShop(post({ action: "deliver" }), "shopB", "soB")).status).toBe(403);
    expect(rows.find((r) => r.id === "soB")?.status).toBe("handed_over");
  });

  it("changes the member's own order and returns the detail with the next actions", async () => {
    const { api: a } = api({ kind: "member", shopId: "shopA", role: "staff" });
    const res = await a.transitionShop(post({ action: "confirm" }), "shopA", "soA");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.event).toMatchObject({ action: "confirm", from: "placed", to: "confirmed", actorRole: "shop_staff" });
    expect(body.shopOrder).toMatchObject({ id: "soA", status: "confirmed", actions: ["pack", "cancel"] });
    expect((await a.transitionShop(post({ action: "fly" }), "shopA", "soA")).status).toBe(422);
    expect((await a.transitionShop(post({ action: "hand_over" }), "shopA", "soA")).status).toBe(409);
  });

  it("rejects non-JSON writes (415) and guests (401)", async () => {
    const { api: a } = api({ kind: "member", shopId: "shopA", role: "staff" });
    const form = new Request("http://x/api", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "action=confirm" });
    expect((await a.transitionShop(form, "shopA", "soA")).status).toBe(415);
    const { api: g } = api({ kind: "guest" });
    expect((await g.transitionShop(post({ action: "confirm" }), "shopA", "soA")).status).toBe(401);
    expect((await g.listAdmin(get())).status).toBe(401);
  });

  it("customers cancel only their own order's shop orders, before confirmation", async () => {
    const { api: a, rows } = api({ kind: "customer", orders: ["BD-261017-AAAAA"] });
    expect((await a.cancelAsCustomer(post({}), "BD-261017-XXXXX", "soX")).status).toBe(404);
    expect((await a.cancelAsCustomer(post({}), "bd-261017-aaaaa", "soX")).status).toBe(404); // soX belongs to another order
    expect((await a.cancelAsCustomer(post({}), "BD-261017-AAAAA", "soB")).status).toBe(409); // handed over
    const ok = await a.cancelAsCustomer(post({ reason: "Ordered twice" }), "bd-261017-aaaaa", "soA");
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ event: { to: "cancelled", actorRole: "customer", restocked: true } });
    expect(rows.find((r) => r.id === "soX")?.status).toBe("placed");
  });

  it("admin endpoints need the Platform Admin", async () => {
    const { api: member } = api({ kind: "member", shopId: "shopA", role: "owner" });
    expect((await member.listAdmin(get())).status).toBe(403);
    expect((await member.transitionAdmin(post({ action: "deliver" }), "soB")).status).toBe(403);
    const { api: admin } = api({ kind: "admin" });
    const list = await (await admin.listAdmin(get())).json();
    expect(list.shopOrders).toHaveLength(3);
    expect(list.handoverRate).toMatchObject({ eligible: 0, rate: null });
    expect(await (await admin.transitionAdmin(post({ action: "deliver" }), "soB")).json()).toMatchObject({ event: { to: "delivered", actorRole: "admin" } });
  });
});

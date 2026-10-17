import { describe, expect, it } from "vitest";
import { createOrdersApi, ORDER_ACCESS_COOKIE, PHONE_PROOF_COOKIE, type ApiUser, type OrdersApiDeps } from "./api";
import { createOrderOtp } from "./otp";
import type { PlaceOrderCommand } from "./placement";
import { addOrderGrant, hasOrderGrant, readPhoneProof } from "./tokens";
import type { OrderRowLike } from "./views";

// The JSON API: standard error shape, owner from the session (never the body), and scoping:
// a user never sees another user's or a guest's order; a guest sees only orders it holds a grant for.

const SECRET = "api-secret";
const NOW = new Date("2026-10-17T06:00:00Z");

function order(orderNo: string, userId: string | null, phone = "+8801711111111"): OrderRowLike & { userId: string | null } {
  return {
    id: `id-${orderNo}`,
    orderNo,
    userId,
    contactName: "X",
    contactPhone: phone,
    contactEmail: null,
    address: { name: "X", phone, division: "Dhaka", district: "Dhaka", upazila: "Dhanmondi", area: "a", line1: "b" },
    zone: "inside_dhaka",
    itemsSubtotal: "100.00",
    deliveryTotal: "70.00",
    grandTotal: "170.00",
    paymentMethod: "cod",
    placedAt: NOW,
    shopOrders: [],
  };
}

const ORDERS = [order("BD-261017-AAAAA", "A"), order("BD-261017-BBBBB", "B"), order("BD-261017-GGGGG", null, "+8801812345678")];

function setup(user: ApiUser | null, jar: Record<string, string> = {}) {
  const placed: PlaceOrderCommand[] = [];
  const saved: unknown[] = [];
  const deps: OrdersApiDeps = {
    currentUser: async () => user,
    cartOwner: async () => (user ? { kind: "user", userId: user.id } : { kind: "guest", guestToken: "g" }),
    addresses: {
      get: async (userId, id) => (userId === "A" && id === "addr-A" ? ORDERS[0].address as never : null),
      create: async (_u, input) => {
        saved.push(input);
      },
    },
    placement: {
      place: async (cmd) => {
        placed.push(cmd);
        return { orderId: "o-new", orderNo: "BD-261017-NNNNN", replayed: false, attachedToAccount: false, shopOrderCount: 2 };
      },
    },
    otp: createOrderOtp({
      otp: {
        requestOtp: async () => ({ ok: true }),
        verifyOtp: async (_p, _purpose, code) => (code === "123456" ? { ok: true } : { ok: false, code: "INVALID" }),
      },
      secret: SECRET,
      now: () => NOW,
      orderAccessTtlMs: 3_600_000,
      accountUsesPhone: async () => false,
      markAccountPhoneVerified: async () => {},
      linkGuestOrders: async () => {},
      findOrderPhone: async (no) => ORDERS.find((o) => o.orderNo === no) ?? null,
    }),
    cookies: {
      get: async (name) => jar[name],
      set: async (name, value) => {
        jar[name] = value;
      },
    },
    meta: async () => ({ ip: null, userAgent: "vitest" }),
    readPhoneProof: (value) => readPhoneProof(SECRET, value, NOW, 30 * 60_000),
    hasGrant: (value, no) => hasOrderGrant(SECRET, value, no, NOW),
    addGrant: (value, no) => addOrderGrant(SECRET, value, no, NOW, 3_600_000),
    phoneProofMaxAgeSec: 1800,
    orderAccessMaxAgeSec: 3600,
    orders: {
      listForUser: async (userId) => ORDERS.filter((o) => o.userId === userId),
      getForUser: async (userId, no) => ORDERS.find((o) => o.userId === userId && o.orderNo === no) ?? null,
      getByNo: async (no) => ORDERS.find((o) => o.orderNo === no) ?? null,
    },
  };
  return { api: createOrdersApi(deps), placed, saved, jar };
}

const userA: ApiUser = { id: "A", name: "A", phone: "+8801711111111", phoneVerifiedAt: NOW, email: null };
const json = (body: unknown) => new Request("http://x/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("order reads are scoped", () => {
  it("lists only the user's own orders and needs a login", async () => {
    const res = await setup(userA).api.listOrders();
    expect((await res.json()).orders.map((o: { orderNo: string }) => o.orderNo)).toEqual(["BD-261017-AAAAA"]);
    const anon = await setup(null).api.listOrders();
    expect([anon.status, (await anon.json()).error.code]).toEqual([401, "UNAUTHORIZED"]);
  });

  it("answers 404 for another user's order and for a guest order (even with the same mobile)", async () => {
    const { api } = setup(userA);
    expect((await api.getOrder("BD-261017-AAAAA")).status).toBe(200);
    for (const no of ["BD-261017-BBBBB", "BD-261017-GGGGG", "BD-261017-ZZZZZ"]) {
      const res = await api.getOrder(no);
      expect([res.status, (await res.json()).error]).toEqual([404, { code: "NOT_FOUND", message: "Order not found" }]);
    }
  });

  it("shows a guest only the order its browser holds a grant for", async () => {
    const jar = { [ORDER_ACCESS_COOKIE]: addOrderGrant(SECRET, undefined, "BD-261017-GGGGG", NOW, 3_600_000) };
    const { api } = setup(null, jar);
    expect((await api.getOrder("bd-261017-ggggg")).status).toBe(200);
    expect((await api.getOrder("BD-261017-AAAAA")).status).toBe(404);
    expect((await setup(null).api.getOrder("BD-261017-GGGGG")).status).toBe(404);
  });
});

describe("POST /api/checkout", () => {
  it("places a logged-in order with a saved address of the user's own; the owner comes from the session", async () => {
    const { api, placed } = setup(userA);
    const res = await api.checkout(json({ idempotencyKey: "k".repeat(20), addressId: "addr-A", acceptPolicies: true, policyVersions: { returns: 1, x: "2" }, userId: "B" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ orderNo: "BD-261017-NNNNN", url: "/orders/BD-261017-NNNNN" });
    expect(placed[0]).toMatchObject({ owner: { kind: "user", userId: "A" }, customer: { kind: "user", userId: "A" }, consent: { accepted: true, shownVersions: { returns: 1 } } });
  });

  it("rejects another user's address id", async () => {
    const res = await setup({ ...userA, id: "B" }).api.checkout(json({ idempotencyKey: "k".repeat(20), addressId: "addr-A" }));
    expect([res.status, (await res.json()).error.fields]).toEqual([422, { addressId: "Choose one of your addresses" }]);
  });

  it("saves a new address to the address book after the order", async () => {
    const { api, placed, saved } = setup(userA);
    const address = { name: "Rahim", phone: "01711111111", division: "Chattogram", district: "Chattogram", upazila: "Panchlaish", area: "GEC", line1: "House 1" };
    expect((await api.checkout(json({ idempotencyKey: "k".repeat(20), address, acceptPolicies: true }))).status).toBe(201);
    expect(placed[0].address).toMatchObject({ district: "Chattogram", phone: "+8801711111111" });
    expect(saved).toHaveLength(1);
  });

  it("validates guest details in the standard error shape", async () => {
    const res = await setup(null).api.checkout(json({ idempotencyKey: "k".repeat(20), contact: { name: "K", phone: "123", email: "nope" } }));
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION");
    expect(Object.keys(body.error.fields).sort()).toEqual(["contact.email", "contact.name", "contact.phone"]);
  });

  it("passes the guest's verified mobile from the proof cookie, and grants the new order page", async () => {
    const jar: Record<string, string> = {};
    const { api, placed } = setup(null, jar);
    await api.checkoutOtp(json({ action: "verify", phone: "01812345678", code: "123456" }));
    expect(jar[PHONE_PROOF_COOKIE]).toBeTruthy();
    const res = await api.checkout(
      json({
        idempotencyKey: "k".repeat(20),
        contact: { name: "Karim", phone: "01812345678", email: "karim@ecom.test" },
        address: { division: "Dhaka", district: "Dhaka", upazila: "Dhanmondi", area: "Dhanmondi 27", line1: "House 1" },
        acceptPolicies: "on",
      }),
    );
    expect(res.status).toBe(201);
    expect(placed[0].customer).toMatchObject({ kind: "guest", phone: "+8801812345678", verifiedPhone: { phone: "+8801812345678" } });
    expect(placed[0].address).toMatchObject({ name: "Karim", phone: "+8801812345678" });
    expect(hasOrderGrant(SECRET, jar[ORDER_ACCESS_COOKIE], "BD-261017-NNNNN", NOW)).toBe(true);
  });

  it("refuses a body that is not JSON (no cross-site form posts)", async () => {
    const req = new Request("http://x/api", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "a=b" });
    expect((await setup(userA).api.checkout(req)).status).toBe(415);
  });
});

describe("POST /api/track", () => {
  it("needs the OTP before showing the order, then grants this browser access", async () => {
    const jar: Record<string, string> = {};
    const { api } = setup(null, jar);
    const sent = await api.track(json({ orderNo: "BD-261017-GGGGG" }));
    expect((await sent.json()).sent).toBe(true);
    const wrong = await api.track(json({ orderNo: "BD-261017-GGGGG", code: "000000" }));
    expect(wrong.status).toBe(422);
    expect(jar[ORDER_ACCESS_COOKIE]).toBeUndefined();
    const ok = await api.track(json({ orderNo: "BD-261017-GGGGG", code: "123456" }));
    expect((await ok.json()).order.orderNo).toBe("BD-261017-GGGGG");
    expect((await api.getOrder("BD-261017-GGGGG")).status).toBe(200);
  });
});

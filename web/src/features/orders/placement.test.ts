import { describe, expect, it } from "vitest";
import { createPlacementService, scopedIdempotencyKey, type CheckoutCustomer, type PlaceOrderCommand } from "./placement";

type GuestCustomer = Extract<CheckoutCustomer, { kind: "guest" }>;
import { createWorld, GUEST_OWNER, HOME_CTG, HOME_DHAKA, KEY, row, USER_OWNER, VARIANTS, verifiedUser } from "./test-fixtures";

// US-051 checkout with cash on delivery and US-007 guest checkout: the placement rules.

const consent = { accepted: true, shownVersions: {} };
const meta = { ip: "203.0.113.1", userAgent: "vitest" };

function userCmd(over: Partial<PlaceOrderCommand> = {}): PlaceOrderCommand {
  return { owner: USER_OWNER, customer: verifiedUser, address: HOME_DHAKA, consent, idempotencyKey: KEY, meta, ...over };
}

function guestCmd(over: Partial<PlaceOrderCommand> = {}, phone = "+8801812345678"): PlaceOrderCommand {
  return {
    owner: GUEST_OWNER,
    customer: {
      kind: "guest",
      name: "Karim",
      phone,
      email: "karim@ecom.test",
      verifiedPhone: { phone, verifiedAt: new Date("2026-10-17T05:55:00Z") },
    },
    address: { ...HOME_DHAKA, name: "Karim", phone },
    consent: { accepted: true, shownVersions: {} },
    idempotencyKey: KEY,
    meta,
    ...over,
  };
}

const twoShopCart = () => [row(VARIANTS.ram, 1), row(VARIANTS.himu, 2)];

async function error(p: Promise<unknown>) {
  try {
    await p;
  } catch (err) {
    return err as { status: number; code: string; message: string; fields?: Record<string, string> };
  }
  throw new Error("expected an error");
}

describe("placement: two shops make two shop orders and one notification", () => {
  it("splits the cart into one shop order per shop with its own delivery charge, and queues ONE notification", async () => {
    const { state, deps } = createWorld(twoShopCart());
    const result = await createPlacementService(deps).place(userCmd());

    expect(result).toMatchObject({ replayed: false, attachedToAccount: false, shopOrderCount: 2 });
    expect(state.placed).toHaveLength(1);
    const draft = state.placed[0];
    expect(draft.shopOrders.map((s) => [s.shopName, s.itemsSubtotal, s.deliveryCharge, s.total])).toEqual([
      ["Tech Shop", "6800.00", "70.00", "6870.00"],
      ["Book Shop", "500.00", "70.00", "570.00"],
    ]);
    expect([draft.itemsSubtotal, draft.deliveryTotal, draft.grandTotal]).toEqual(["7300.00", "140.00", "7440.00"]);
    expect(draft.userId).toBe("u-1");
    expect(draft.contactPhone).toBe("+8801711111111");
    expect(draft.policyVersions).toEqual([
      { slug: "returns", version: 1 },
      { slug: "delivery", version: 1 },
    ]);
    expect(state.notifications).toEqual([result.orderId]);
    // The ordered cart lines are removed in the same transaction.
    expect(state.cleared).toEqual([{ owner: USER_OWNER, ids: ["ci-v-ram", "ci-v-himu"] }]);
    expect(state.stock.get("v-ram")).toBe(24);
    expect(state.stock.get("v-himu")).toBe(38);
  });

  it("sets the 48 h handover deadline from the placing time", async () => {
    const { state, deps } = createWorld(twoShopCart());
    await createPlacementService(deps).place(userCmd());
    for (const so of state.placed[0].shopOrders) expect(so.handoverDueAt.toISOString()).toBe("2026-10-19T06:00:00.000Z");
  });

  it("never fails the order when the notification can't be queued", async () => {
    const { state, deps } = createWorld(twoShopCart());
    const logged: string[] = [];
    const service = createPlacementService({
      ...deps,
      enqueueNotification: async () => {
        throw new Error("pg-boss down");
      },
      log: (m) => logged.push(m),
    });
    const result = await service.place(userCmd());
    expect(result.replayed).toBe(false);
    expect(state.placed).toHaveLength(1);
    expect(logged[0]).toContain("not queued");
  });
});

describe("placement: delivery charge from the chosen address (D9)", () => {
  it("charges the outside-Dhaka rate on every shop order for an address outside Dhaka district", async () => {
    const { state, deps } = createWorld(twoShopCart());
    await createPlacementService(deps).place(userCmd({ address: HOME_CTG }));
    expect(state.zonesAsked).toEqual(["outside_dhaka"]);
    const draft = state.placed[0];
    expect(draft.zone).toBe("outside_dhaka");
    expect(draft.shopOrders.map((s) => [s.deliveryCharge, s.total])).toEqual([
      ["130.00", "6930.00"],
      ["130.00", "630.00"],
    ]);
    expect(draft.grandTotal).toBe("7560.00");
  });

  it("uses inside Dhaka only for Dhaka district (Gazipur is outside)", async () => {
    const { state, deps } = createWorld([row(VARIANTS.himu)]);
    await createPlacementService(deps).place(userCmd({ address: { ...HOME_DHAKA, district: "Gazipur", upazila: "Tongi" } }));
    expect(state.zonesAsked).toEqual(["outside_dhaka"]);
  });

  it("applies the free-delivery threshold per shop and the per-kg extra", async () => {
    // 2 × Ryzen 5 = Tk 49,000 >= Tk 10,000 (free); 4 × maths = 2.4 kg -> Tk 70 + 2 × Tk 20.
    const { state, deps } = createWorld([row(VARIANTS.cpu, 2), row(VARIANTS.maths, 4)]);
    await createPlacementService(deps).place(userCmd());
    const [tech, books] = state.placed[0].shopOrders;
    expect([tech.deliveryCharge, tech.freeDelivery]).toEqual(["0.00", true]);
    expect([books.deliveryCharge, books.weightGrams]).toEqual(["110.00", 2400]);
  });
});

describe("placement: verified mobile first (OTP)", () => {
  it("blocks an account whose phone is not verified", async () => {
    const { state, deps } = createWorld(twoShopCart());
    const err = await error(createPlacementService(deps).place(userCmd({ customer: { ...verifiedUser, phoneVerifiedAt: null } })));
    expect([err.status, err.code]).toEqual([422, "PHONE_NOT_VERIFIED"]);
    expect(state.placed).toHaveLength(0);
  });

  it("blocks an account without a phone", async () => {
    const { deps } = createWorld(twoShopCart());
    const err = await error(createPlacementService(deps).place(userCmd({ customer: { ...verifiedUser, phone: null, phoneVerifiedAt: null } })));
    expect(err.code).toBe("PHONE_REQUIRED");
  });

  it("blocks a guest without an OTP proof, or with a proof for another mobile", async () => {
    const { state, deps } = createWorld(twoShopCart());
    const service = createPlacementService(deps);
    const base = guestCmd();
    const none = await error(service.place({ ...base, customer: { ...(base.customer as GuestCustomer), verifiedPhone: null } }));
    expect([none.status, none.code, none.fields]).toEqual([422, "PHONE_NOT_VERIFIED", { phone: "Verify this mobile number first" }]);
    const other = await error(
      service.place({ ...base, customer: { ...(base.customer as GuestCustomer), verifiedPhone: { phone: "+8801999999999", verifiedAt: new Date() } } }),
    );
    expect(other.code).toBe("PHONE_NOT_VERIFIED");
    expect(state.placed).toHaveLength(0);
  });

  it("places a guest order with a verified mobile and records the guest's policy acceptance", async () => {
    const { state, deps } = createWorld(twoShopCart());
    const result = await createPlacementService(deps).place(guestCmd());
    expect(result.attachedToAccount).toBe(false);
    const draft = state.placed[0];
    expect(draft.userId).toBeNull();
    expect(draft.contactEmail).toBe("karim@ecom.test");
    expect(draft.phoneVerifiedAt.toISOString()).toBe("2026-10-17T05:55:00.000Z");
    expect(state.acceptances).toEqual([expect.objectContaining({ guestPhone: "+8801812345678", slugs: ["returns", "delivery", "privacy"] })]);
    expect(draft.policyVersions.map((p) => p.slug)).toEqual(["returns", "delivery", "privacy"]);
  });
});

describe("placement: current Return and Delivery policies must be accepted", () => {
  it("blocks an account that has not accepted them and did not tick the box", async () => {
    const { state, deps } = createWorld(twoShopCart());
    const err = await error(createPlacementService(deps).place(userCmd({ consent: { accepted: false, shownVersions: {} } })));
    expect([err.status, err.code]).toEqual([422, "POLICY_ACCEPTANCE_REQUIRED"]);
    expect(state.placed).toHaveLength(0);
  });

  it("records the acceptance when the box is ticked, with the versions shown", async () => {
    const { state, deps } = createWorld(twoShopCart());
    await createPlacementService(deps).place(userCmd({ consent: { accepted: true, shownVersions: { returns: 1, delivery: 1 } } }));
    expect(state.acceptances).toEqual([
      expect.objectContaining({ userId: "u-1", slugs: ["returns", "delivery"], shownVersions: { returns: 1, delivery: 1 }, ip: "203.0.113.1" }),
    ]);
  });

  it("lets an account that accepted the current versions before order without ticking again", async () => {
    const { state, deps } = createWorld(twoShopCart());
    state.accepted.add("u-1");
    await createPlacementService(deps).place(userCmd({ consent: { accepted: false, shownVersions: {} } }));
    expect(state.placed[0].policyVersions).toHaveLength(2);
    expect(state.acceptances).toHaveLength(0);
  });

  it("always needs the box for a guest", async () => {
    const { state, deps } = createWorld(twoShopCart());
    const err = await error(createPlacementService(deps).place(guestCmd({ consent: { accepted: false, shownVersions: {} } })));
    expect([err.code, err.fields]).toEqual(["POLICY_ACCEPTANCE_REQUIRED", { acceptPolicies: "Tick the box to accept the policies" }]);
    expect(state.placed).toHaveLength(0);
  });

  it("passes on a changed-policy error from the policies feature and places nothing", async () => {
    const { state, deps } = createWorld(twoShopCart());
    const service = createPlacementService({
      ...deps,
      policies: {
        ...deps.policies,
        recordAcceptance: async () => {
          throw Object.assign(new Error("A policy was updated"), { status: 409, code: "POLICY_CHANGED" });
        },
      },
    });
    const err = await error(service.place(userCmd()));
    expect(err.code).toBe("POLICY_CHANGED");
    expect(state.placed).toHaveLength(0);
  });
});

describe("placement: fake-order limits (D8)", () => {
  it("shows the limit message to a mobile with 3 open COD orders and no delivered order", async () => {
    const { state, deps } = createWorld(twoShopCart());
    state.history = { openOrders: 3, delivered: 0, refused: 0 };
    const err = await error(createPlacementService(deps).place(userCmd()));
    expect([err.status, err.code]).toEqual([409, "OPEN_ORDER_LIMIT"]);
    expect(err.message).toBe("You already have 3 open cash-on-delivery orders. You can place a new order once one of them is delivered.");
    expect(state.placed).toHaveLength(0);
    expect(state.historyAsked).toEqual([{ phone: "+8801711111111", userId: "u-1" }]);
  });

  it("allows a 3rd open order, and more once one order was delivered", async () => {
    for (const history of [
      { openOrders: 2, delivered: 0, refused: 0 },
      { openOrders: 5, delivered: 1, refused: 0 },
    ]) {
      const { state, deps } = createWorld(twoShopCart());
      state.history = history;
      await createPlacementService(deps).place(userCmd());
      expect(state.placed).toHaveLength(1);
    }
  });

  it("blocks cash on delivery after 2 refused deliveries, for guests too (keyed by the mobile)", async () => {
    const { state, deps } = createWorld(twoShopCart());
    state.history = { openOrders: 0, delivered: 4, refused: 2 };
    const err = await error(createPlacementService(deps).place(guestCmd()));
    expect([err.status, err.code]).toEqual([403, "COD_BLOCKED"]);
    expect(state.historyAsked).toEqual([{ phone: "+8801812345678", userId: null }]);
    expect(state.placed).toHaveLength(0);
  });

  it("uses the configured values", async () => {
    const { state, deps } = createWorld(twoShopCart());
    state.history = { openOrders: 1, delivered: 0, refused: 0 };
    const service = createPlacementService({ ...deps, config: { ...deps.config, maxOpenCodOrdersWithoutDelivery: 1 } });
    expect((await error(service.place(userCmd()))).code).toBe("OPEN_ORDER_LIMIT");
  });
});

describe("placement: Basic shops take at most 20 open orders (D14)", () => {
  it("blocks the checkout naming the full Basic shop", async () => {
    const { state, deps } = createWorld(twoShopCart());
    state.openByShop["shop-books"] = 20;
    const err = await error(createPlacementService(deps).place(userCmd()));
    expect([err.status, err.code]).toEqual([409, "SHOP_ORDER_LIMIT"]);
    expect(err.message).toContain("Book Shop can't take more orders right now");
    expect(err.fields).toEqual({ "shop-books": "Book Shop has reached its limit of 20 open orders." });
    expect(state.placed).toHaveLength(0);
  });

  it("allows the 20th open order, and Verified shops have no limit", async () => {
    const { state, deps } = createWorld(twoShopCart());
    state.openByShop["shop-books"] = 19;
    state.openByShop["shop-tech"] = 500;
    await createPlacementService(deps).place(userCmd());
    expect(state.placed).toHaveLength(1);
  });
});

describe("placement: the cart must be ready", () => {
  it("blocks while a changed price is not accepted", async () => {
    const { state, deps } = createWorld([row(VARIANTS.maths, 1, { priceAtAdd: "600.00" })]);
    const err = await error(createPlacementService(deps).place(userCmd()));
    expect([err.status, err.code]).toEqual([409, "CART_NOT_READY"]);
    expect(err.message).toContain("Accept the new price");
    expect(state.placed).toHaveLength(0);
  });

  it("blocks an empty cart", async () => {
    const { deps } = createWorld([]);
    expect((await error(createPlacementService(deps).place(userCmd()))).code).toBe("CART_NOT_READY");
  });

  it("leaves saved-for-later lines in the cart", async () => {
    const saved = row(VARIANTS.cpu, 1, { savedForLater: true });
    const { state, deps } = createWorld([row(VARIANTS.himu), saved]);
    await createPlacementService(deps).place(userCmd());
    expect(state.cleared[0].ids).toEqual(["ci-v-himu"]);
    expect(state.rows.map((r) => r.id)).toEqual([saved.id]);
  });
});

describe("placement: stock race", () => {
  it("fails with a clear message naming the item and creates nothing when another checkout took the stock", async () => {
    const { state, deps } = createWorld([row(VARIANTS.ram, 1), row(VARIANTS.cpu, 2)]);
    // Between reading the cart and the transaction, someone bought one Ryzen.
    state.beforePlace = () => state.stock.set("v-cpu", 1);
    const err = await error(createPlacementService(deps).place(userCmd()));
    expect([err.status, err.code]).toEqual([409, "OUT_OF_STOCK"]);
    expect(err.message).toBe("Only 1 of Ryzen 5 left now. Lower the quantity in your cart and try again.");
    expect(err.fields).toEqual({ "v-cpu": err.message });
    expect(state.placed).toHaveLength(0);
    expect(state.stock.get("v-ram")).toBe(25); // nothing decremented
    expect(state.cleared).toHaveLength(0);
    expect(state.notifications).toHaveLength(0);
  });

  it("says sold out when nothing is left, and price changed when only the price moved", async () => {
    const soldOut = createWorld([row(VARIANTS.cpu, 1)]);
    soldOut.state.beforePlace = () => soldOut.state.stock.set("v-cpu", 0);
    expect((await error(createPlacementService(soldOut.deps).place(userCmd()))).message).toBe(
      "Ryzen 5 sold out just now. Remove it from your cart to order the rest.",
    );
    const repriced = createWorld([row(VARIANTS.cpu, 1)]);
    repriced.state.beforePlace = () => repriced.state.prices.set("v-cpu", "25000.00");
    expect((await error(createPlacementService(repriced.deps).place(userCmd()))).code).toBe("PRICE_CHANGED");
  });
});

describe("placement: idempotency (double submit)", () => {
  it("returns the first order for the same form key and places nothing new", async () => {
    const { state, deps } = createWorld(twoShopCart());
    const service = createPlacementService(deps);
    const first = await service.place(userCmd());
    // The cart is now empty, but a resubmit must still answer with the same order.
    const second = await service.place(userCmd());
    expect(second).toEqual({ orderId: first.orderId, orderNo: first.orderNo, replayed: true, attachedToAccount: false });
    expect(state.placed).toHaveLength(1);
    expect(state.notifications).toHaveLength(1);
  });

  it("scopes the key by owner, so another customer's equal key is a new order", () => {
    expect(scopedIdempotencyKey(USER_OWNER, KEY)).not.toBe(scopedIdempotencyKey(GUEST_OWNER, KEY));
    expect(scopedIdempotencyKey(USER_OWNER, KEY)).toBe(scopedIdempotencyKey({ kind: "user", userId: "u-1" }, KEY));
  });

  it("rejects a missing or malformed key", async () => {
    const { deps } = createWorld(twoShopCart());
    for (const key of [undefined, "", "short", "has spaces in it!!!!", 42]) {
      expect((await error(createPlacementService(deps).place(userCmd({ idempotencyKey: key })))).code).toBe("VALIDATION");
    }
  });

  it("tries a new order number when one is taken", async () => {
    const { OrderNoTakenError } = await import("./placement");
    const { state, deps } = createWorld(twoShopCart());
    let calls = 0;
    const service = createPlacementService({
      ...deps,
      store: {
        ...deps.store,
        place: async (...args) => {
          if (calls++ === 0) throw new OrderNoTakenError();
          return deps.store.place(...args);
        },
      },
    });
    const result = await service.place(userCmd());
    expect(calls).toBe(2);
    expect(result.orderNo).toBe(state.placed[0].orderNo);
  });
});

describe("placement: guest order and accounts (US-007, US-009)", () => {
  it("attaches the guest order to the account whose verified mobile the guest just verified", async () => {
    const { state, deps } = createWorld(twoShopCart());
    state.verifiedAccounts.set("+8801812345678", "u-owner");
    const result = await createPlacementService(deps).place(guestCmd());
    expect(result.attachedToAccount).toBe(true);
    expect(state.placed[0]).toMatchObject({ userId: "u-owner", linkedVia: "checkout_phone" });
  });

  it("does NOT attach by a typed email: someone else's email with a different verified mobile stays a guest order", async () => {
    const { state, deps } = createWorld(twoShopCart());
    // The account of rahim@ecom.test uses another mobile; the guest typed rahim's email.
    state.verifiedAccounts.set("+8801711111111", "u-1");
    const cmd = guestCmd();
    await createPlacementService(deps).place({ ...cmd, customer: { ...(cmd.customer as GuestCustomer), email: "rahim@ecom.test" } });
    expect(state.placed[0]).toMatchObject({ userId: null, linkedVia: null, contactEmail: "rahim@ecom.test" });
  });
});

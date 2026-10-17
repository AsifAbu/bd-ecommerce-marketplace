import { beforeEach, describe, expect, it } from "vitest";
import { ReturnError } from "./errors";
import type { ExistingReturn, ReturnStatus } from "./rules";
import { createReturnsService, type ItemForReturn, type NewReturn, type ReturnEffects, type ReturnEvent, type ReturnRecord, type ReturnScope, type ReturnsStore } from "./service";

// US-070 / US-071 through the service with an in-memory store: request, shop answer, 48 h
// escalation job, admin decision, refund recording with its notification, restock, scoping.

type Row = NewReturn & ReturnRecord & Record<string, unknown>;

function memoryStore() {
  const rows: Row[] = [];
  const stock: Record<string, number> = { v1: 5 };
  const shopOrders: Record<string, string> = { so1: "delivered" };
  const audits: string[] = [];
  const items: Record<string, ItemForReturn> = {
    i1: {
      order: { id: "o1", orderNo: "BD-261010-AAAAA", userId: "u1", contactPhone: "+8801711111111", policyVersions: [{ slug: "returns", version: 3 }] },
      shopOrder: { id: "so1", shopId: "s1", status: "delivered", deliveredAt: new Date("2026-10-10T09:00:00Z") },
      item: { id: "i1", title: "Oxford shirt", quantity: 2, returnEligibility: "change_of_mind", medicine: false },
      existing: [],
    },
    med: {
      order: { id: "o1", orderNo: "BD-261010-AAAAA", userId: "u1", contactPhone: "+8801711111111", policyVersions: [] },
      shopOrder: { id: "so1", shopId: "s1", status: "delivered", deliveredAt: new Date("2026-10-10T09:00:00Z") },
      item: { id: "med", title: "Paracetamol", quantity: 1, returnEligibility: "eligible", medicine: true },
      existing: [],
    },
  };
  const inScope = (scope: ReturnScope, r: Row) => (scope.kind === "order" ? r.orderId === scope.orderId : scope.kind === "shop" ? r.shopId === scope.shopId : true);
  const store: ReturnsStore = {
    async itemForReturn(orderId, itemId) {
      const f = items[itemId];
      if (!f || f.order.id !== orderId) return null;
      return { ...f, existing: rows.filter((r) => r.orderItemId === itemId).map((r) => ({ status: r.status, quantity: r.quantity })) };
    },
    async create(data, recheck) {
      recheck(rows.filter((r) => r.orderItemId === data.orderItemId).map((r): ExistingReturn => ({ status: r.status, quantity: r.quantity })));
      const id = `r${rows.length + 1}`;
      rows.push({
        ...data,
        id,
        orderNo: "BD-261010-AAAAA",
        status: "requested",
        shopRespondedAt: null,
        receivedAt: null,
        restockedAt: null,
        unitPrice: "1850.00",
        variantId: "v1",
        deliveryCharge: "70.00",
      } as Row);
      return { id };
    },
    async find(scope, id) {
      const r = rows.find((x) => x.id === id && inScope(scope, x));
      return r ? { ...r } : null;
    },
    async update(id, from, data, effects: ReturnEffects = {}) {
      const r = rows.find((x) => x.id === id);
      if (!r || !from.includes(r.status)) return false;
      Object.assign(r, data);
      if (effects.restock) stock[effects.restock.variantId] += effects.restock.quantity;
      if (effects.completeShopOrder) {
        const refunded = rows.filter((x) => x.shopOrderId === r.shopOrderId && x.status === "refunded").reduce((n, x) => n + x.quantity, 0);
        if (refunded >= 2) shopOrders[r.shopOrderId] = "returned";
      }
      return true;
    },
    async deliveryAlreadyRefunded(shopOrderId, exceptId) {
      return rows.some((x) => x.shopOrderId === shopOrderId && x.id !== exceptId && x.status === "refunded" && Number(x.refundDelivery) > 0);
    },
    async listOverdue(now) {
      return rows.filter((r) => r.status === "requested" && r.shopDueAt <= now).map((r) => ({ id: r.id, shopDueAt: r.shopDueAt }));
    },
    async audit(_actor, action, id) {
      audits.push(`${action}:${id}`);
    },
  };
  return { store, rows, stock, shopOrders, audits };
}

let clock: Date;
let mem: ReturnType<typeof memoryStore>;
let sent: { id: string; event: ReturnEvent }[];
let testMode: boolean;
let uploads: string[];
let failUpload: boolean;
let service: ReturnType<typeof createReturnsService>;

beforeEach(() => {
  clock = new Date("2026-10-12T04:00:00Z");
  mem = memoryStore();
  sent = [];
  testMode = true;
  uploads = [];
  failUpload = false;
  service = createReturnsService({
    store: mem.store,
    now: () => clock,
    notify: async (id, event) => {
      sent.push({ id, event });
    },
    photos: {
      get testMode() {
        return testMode;
      },
      newKey: (ext) => `returns/k${uploads.length}${ext}`,
      putObject: async (key) => {
        if (failUpload) throw new Error("MinIO down");
        uploads.push(key);
      },
    },
  });
});

const err = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if (e instanceof ReturnError) return e;
    throw e;
  }
  throw new Error("expected a ReturnError");
};

const ask = (over: Record<string, unknown> = {}) => ({ orderItemId: "i1", quantity: "1", reason: "change_of_mind", details: "", ...over });
const photo = (type = "image/jpeg") => ({ name: "p.jpg", type, size: 100, bytes: async () => new Uint8Array([1]) });

describe("request (US-070)", () => {
  it("saves the request with a 48 h shop due time, the accepted policy version, and tells the shop", async () => {
    const { id, warning } = await service.request("o1", "u1", ask());
    expect(warning).toBeNull();
    expect(mem.rows[0]).toMatchObject({ id, status: "requested", quantity: 1, reason: "change_of_mind", shopId: "s1", userId: "u1", policyVersion: 3 });
    expect(mem.rows[0].shopDueAt.toISOString()).toBe("2026-10-14T04:00:00.000Z");
    expect(sent).toEqual([{ id, event: "requested" }]);
  });

  it("is blocked 8 days after delivery with the policy message, and nothing is saved", async () => {
    clock = new Date("2026-10-18T03:00:00Z"); // 18 Oct, 09:00 in Dhaka
    const e = await err(service.request("o1", null, ask()));
    expect(e.code).toBe("RETURN_WINDOW_CLOSED");
    expect(e.message).toContain("within 7 days of delivery");
    expect(mem.rows).toHaveLength(0);
  });

  it("blocks medicine that is not damaged or wrong with the exclusion reason", async () => {
    const e = await err(service.request("o1", null, ask({ orderItemId: "med", reason: "not_as_described" })));
    expect(e.code).toBe("RETURN_NOT_ELIGIBLE");
    expect(e.message).toMatch(/^Medicine can't be returned/);
    await expect(service.request("o1", null, ask({ orderItemId: "med", reason: "damaged" }))).resolves.toMatchObject({ id: "r1" });
  });

  it("finds items only inside the order the customer may open", async () => {
    expect((await err(service.request("other-order", "u1", ask()))).status).toBe(404);
  });

  it("allows one open request per item (re-checked at write time)", async () => {
    await service.request("o1", null, ask());
    expect((await err(service.request("o1", null, ask()))).code).toBe("RETURN_ALREADY_OPEN");
  });

  it("test mode: photos optional, and a storage failure still saves the request without them", async () => {
    failUpload = true;
    const { warning } = await service.request("o1", null, ask({ reason: "damaged", photos: [photo()] }));
    expect(warning).toMatch(/could not be saved/);
    expect(mem.rows[0].photoKeys).toEqual([]);
  });

  it("production: a photo is required for a damaged item, and a storage failure refuses with 503", async () => {
    testMode = false;
    expect((await err(service.request("o1", null, ask({ reason: "damaged" })))).fields?.photos).toBeDefined();
    failUpload = true;
    const e = await err(service.request("o1", null, ask({ reason: "damaged", photos: [photo()] })));
    expect([e.status, e.code]).toEqual([503, "PHOTO_UPLOAD_UNAVAILABLE"]);
    expect(mem.rows).toHaveLength(0);
    failUpload = false;
    await service.request("o1", null, ask({ reason: "damaged", photos: [photo()] }));
    expect(mem.rows[0].photoKeys).toEqual(["returns/k0.jpg"]);
  });
});

describe("shop answer within 48 h, escalation and admin decision (US-071)", () => {
  it("escalates a request the shop has not answered in 48 h to the admin, once, and notifies", async () => {
    const { id } = await service.request("o1", null, ask());
    clock = new Date("2026-10-14T03:59:00Z");
    expect((await service.escalateOverdue()).escalated).toEqual([]);
    clock = new Date("2026-10-14T04:00:00Z");
    expect((await service.escalateOverdue()).escalated).toEqual([id]);
    expect(mem.rows[0]).toMatchObject({ status: "escalated", escalationReason: "no_response" });
    expect(sent.at(-1)).toEqual({ id, event: "escalated" });
    expect((await service.escalateOverdue()).escalated).toEqual([]);
    // The shop can no longer answer; the admin decides.
    expect((await err(service.accept("s1", "staff", id))).code).toBe("RETURN_STATE");
    await service.decide("admin", id, "approve", "");
    expect(mem.rows[0]).toMatchObject({ status: "approved", adminDecidedById: "admin" });
    expect(sent.at(-1)?.event).toBe("approved");
  });

  it("does not escalate an answered request", async () => {
    const { id } = await service.request("o1", null, ask());
    await service.accept("s1", "staff", id, "Courier collects on Sunday");
    clock = new Date("2026-10-20T00:00:00Z");
    expect((await service.escalateOverdue()).escalated).toEqual([]);
  });

  it("a rejection needs a reason; the customer can send it to the admin, who can deny it", async () => {
    const { id } = await service.request("o1", null, ask());
    expect((await err(service.reject("s1", "staff", id, ""))).fields?.note).toBeDefined();
    await service.reject("s1", "staff", id, "Worn, tags removed");
    expect(sent.at(-1)?.event).toBe("rejected");
    await service.dispute({ kind: "order", orderId: "o1" }, null, id, "Never worn, tags are on");
    expect(mem.rows[0]).toMatchObject({ status: "escalated", escalationReason: "customer_dispute" });
    expect((await err(service.decide("admin", id, "deny", ""))).fields?.note).toBeDefined();
    await service.decide("admin", id, "deny", "Photos show wear");
    expect(mem.rows[0].status).toBe("denied");
  });

  it("another shop can't see or answer the request", async () => {
    const { id } = await service.request("o1", null, ask());
    expect((await err(service.accept("s2", "intruder", id))).status).toBe(404);
    expect((await err(service.refund({ kind: "shop", shopId: "s2" }, "intruder", id, { method: "bkash", reference: "TX1", amount: 1 }))).status).toBe(404);
    expect(mem.rows[0].status).toBe("requested");
  });

  it("a double click applies once (conditional update)", async () => {
    const { id } = await service.request("o1", null, ask());
    await service.accept("s1", "staff", id);
    expect((await err(service.accept("s1", "staff", id))).code).toBe("RETURN_STATE");
  });

  it("the customer cancels only before the shop answers", async () => {
    const { id } = await service.request("o1", null, ask());
    await service.cancel({ kind: "order", orderId: "o1" }, null, id);
    expect(mem.rows[0].status).toBe("cancelled");
    const second = await service.request("o1", null, ask());
    await service.accept("s1", "staff", second.id);
    expect((await err(service.cancel({ kind: "order", orderId: "o1" }, null, second.id))).code).toBe("RETURN_STATE");
  });
});

describe("refund recording (US-071)", () => {
  it("the shop records method, reference and amount; the customer is notified; stock is restored once on receipt", async () => {
    const { id } = await service.request("o1", null, ask({ reason: "damaged" }));
    await service.accept("s1", "staff", id);
    await service.receive({ kind: "shop", shopId: "s1" }, "staff", id, "on");
    expect(mem.stock.v1).toBe(6);
    expect(mem.rows[0].restockedAt).toEqual(clock);

    expect((await err(service.refund({ kind: "shop", shopId: "s1" }, "staff", id, { method: "paypal", reference: "X", amount: 10 }))).fields?.method).toBeDefined();
    expect((await err(service.refund({ kind: "shop", shopId: "s1" }, "staff", id, { method: "bkash", reference: "", amount: 10 }))).fields?.reference).toBeDefined();
    // Damaged: item Tk 1,850 + delivery Tk 70 at most.
    expect((await err(service.refund({ kind: "shop", shopId: "s1" }, "staff", id, { method: "bkash", reference: "8N7A6B5C", amount: 1920.01 }))).fields?.amount).toBeDefined();

    const money = await service.refund({ kind: "shop", shopId: "s1" }, "staff", id, { method: "bkash", reference: "8N7A6B5C", amount: "1920" });
    expect(money).toEqual({ amount: "1920.00", delivery: "70.00" });
    expect(mem.rows[0]).toMatchObject({ status: "refunded", refundMethod: "bkash", refundReference: "8N7A6B5C", refundAmount: "1920.00", refundDelivery: "70.00", refundedById: "staff" });
    expect(sent.at(-1)).toEqual({ id, event: "refunded" });
    expect(mem.stock.v1).toBe(6); // not restocked twice
    expect(mem.audits).toContain(`return.refund:${id}`);
  });

  it("refunding an accepted return marks it received; the shop order is returned when fully refunded", async () => {
    const first = await service.request("o1", null, ask({ quantity: "2" }));
    await service.accept("s1", "staff", first.id);
    await service.refund({ kind: "shop", shopId: "s1" }, "staff", first.id, { method: "cash", reference: "Receipt 12", amount: 3700, restock: "on" });
    expect(mem.rows[0].receivedAt).toEqual(clock);
    expect(mem.stock.v1).toBe(7);
    expect(mem.shopOrders.so1).toBe("returned");
  });

  it("the admin may record the refund (platform-held COD money); the customer scope may not", async () => {
    const { id } = await service.request("o1", null, ask());
    await service.accept("s1", "staff", id);
    expect((await err(service.refund({ kind: "order", orderId: "o1" }, "u1", id, { method: "bkash", reference: "TX1", amount: 1 }))).status).toBe(403);
    await service.refund({ kind: "admin" }, "admin", id, { method: "nagad", reference: "NG-1", amount: 1850 });
    expect(mem.rows[0].status as ReturnStatus).toBe("refunded");
  });
});

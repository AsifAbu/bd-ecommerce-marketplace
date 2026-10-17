import { describe, expect, it, vi } from "vitest";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";
import { createPayoutsApi } from "./api";
import { loadPayoutConfig } from "./ledger";
import { createPayoutService, runPayoutDueCheck, type PayoutStore } from "./service";
import type { CollectionRowLike, PayoutRowLike } from "./views";

// The payouts service and JSON API: the shop ledger is owner-only and scoped to the checked shop,
// admin work needs the Platform Admin, input is validated (method, reference, reason), and the
// daily 10-day check emails the admins.

const NOW = new Date("2026-10-17T06:00:00Z");
const d = (days: number) => new Date(NOW.getTime() + days * 86_400_000);
const config = loadPayoutConfig({});

const collection = (id: string, shopId: string, due: number, status = "delivered", paid: number | null = null): CollectionRowLike => ({
  id,
  shopId,
  shopOrderId: `so-${id}`,
  amount: "1070.00",
  deliveryCharge: "70.00",
  commission: "100.00",
  collectedAt: d(due - 10),
  source: "auto_on_delivery",
  payoutDueAt: d(due),
  payoutId: paid === null ? null : "p1",
  paidOutAt: paid === null ? null : d(paid),
  shop: { name: `Shop ${shopId}` },
  shopOrder: { seq: 1, status, launchOffer: false, order: { orderNo: "BD-261017-AAAAA" } },
});

const payout = (id: string, shopId: string, status: PayoutRowLike["status"]): PayoutRowLike => ({
  id,
  shopId,
  periodStart: d(-5),
  periodEnd: d(-5),
  collectionCount: 1,
  gross: "1070.00",
  commission: "100.00",
  deliveryCharges: "70.00",
  deliveryChargesTo: "shop",
  net: "970.00",
  status,
  dueAt: d(5),
  paidAt: status === "paid" ? d(-1) : null,
  method: status === "paid" ? "bkash" : null,
  reference: status === "paid" ? "TRX1" : null,
  cancelReason: null,
  createdAt: d(-2),
  shop: { name: `Shop ${shopId}` },
});

function store(): PayoutStore & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  const collections = [collection("a1", "A", 1), collection("a2", "A", -1), collection("a3", "A", -2, "returned"), collection("a4", "A", -9, "delivered", -3), collection("b1", "B", 4)];
  const payouts = [payout("pA", "A", "paid"), payout("pB", "B", "pending")];
  return {
    calls,
    listCollectionsForShop: async (shopId) => collections.filter((c) => c.shopId === shopId),
    listPayoutsForShop: async (shopId) => payouts.filter((p) => p.shopId === shopId),
    listUnbatchedCollections: async () => collections.filter((c) => !c.payoutId),
    listPayouts: async ({ status }) => payouts.filter((p) => !status || p.status === status),
    createPayoutBatch: async (shopId, actorId, to) => {
      calls.push(["batch", shopId, actorId, to]);
      return payout("new", shopId, "pending");
    },
    markPayoutPaid: async (...args) => void calls.push(["paid", ...args]),
    cancelPayout: async (...args) => void calls.push(["cancel", ...args]),
    recordCollectionManually: async (...args) => (calls.push(["record", ...args]), { id: "c-new" }),
  };
}

const service = (s = store()) => createPayoutService({ store: s, config, now: () => NOW });

describe("shop ledger", () => {
  it("shows the shop's collections with due states, totals and payouts", async () => {
    const ledger = await service().shopLedger("A");
    expect(ledger.collections.map((c) => [c.id, c.dueState, c.payable])).toEqual([
      ["a1", "due_soon", true],
      ["a2", "overdue", true],
      ["a3", "overdue", false],
      ["a4", "paid", true],
    ]);
    // Unpaid: a1 + a2, each 1070 - 100 (delivery stays with the shop).
    expect(ledger.totals).toEqual({ unpaidNet: 194000, dueSoon: 1, overdue: 1, paidNet: 97000 });
    expect(ledger.payouts.map((p) => p.id)).toEqual(["pA"]);
    expect((await service().shopLedger("B")).collections.map((c) => c.id)).toEqual(["b1"]);
  });
});

describe("admin work", () => {
  it("summarises collections due per shop with pending and paid payouts", async () => {
    const o = await service().adminOverview();
    expect(o.due.map((s) => [s.shopId, s.state, s.payableCount, s.excludedCount])).toEqual([
      ["A", "overdue", 2, 1],
      ["B", "upcoming", 1, 0],
    ]);
    expect(o.pending.map((p) => p.id)).toEqual(["pB"]);
    expect(o.recent.map((p) => p.id)).toEqual(["pA"]);
  });

  it("validates before writing", async () => {
    const s = store();
    const svc = service(s);
    await expect(svc.createBatch("admin", {})).rejects.toMatchObject({ status: 422, fields: { shopId: "Missing id" } });
    await expect(svc.markPaid("admin", "p1", { method: "paypal", reference: "X1234" })).rejects.toMatchObject({ status: 422, fields: { method: expect.any(String) } });
    await expect(svc.markPaid("admin", "p1", { method: "bkash", reference: "ab" })).rejects.toMatchObject({ fields: { reference: expect.stringMatching(/at least 3/) } });
    await expect(svc.cancel("admin", "p1", { reason: "" })).rejects.toMatchObject({ fields: { reason: expect.any(String) } });
    expect(s.calls).toEqual([]);
    await svc.markPaid("admin", "p1", { method: "bkash", reference: " TRX-77 " });
    await svc.createBatch("admin", { shopId: "A" });
    await svc.recordCollection("admin", { shopOrderId: "so1" });
    expect(s.calls).toEqual([
      ["paid", "p1", { method: "bkash", reference: "TRX-77" }, "admin", NOW],
      ["batch", "A", "admin", "shop"],
      ["record", "so1", "admin", NOW, 10],
    ]);
  });
});

describe("payouts JSON API", () => {
  type Who = { kind: "owner" | "staff"; shopId: string } | { kind: "admin" } | { kind: "guest" };
  function api(who: Who) {
    const s = store();
    return {
      s,
      api: createPayoutsApi({
        requireShopOwner: async (shopId) => {
          if (who.kind === "guest") throw new UnauthorizedError();
          if (who.kind !== "owner" || who.shopId !== shopId) throw new ForbiddenError("Not allowed for this shop");
          return { shopId };
        },
        requireAdmin: async () => {
          if (who.kind === "guest") throw new UnauthorizedError();
          if (who.kind !== "admin") throw new ForbiddenError();
          return { id: "admin" };
        },
        service: service(s),
      }),
    };
  }
  const post = (body: unknown) => new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  it("shows a shop's ledger to its owner only (not staff, not another shop's owner)", async () => {
    const owner = await api({ kind: "owner", shopId: "A" }).api.shopLedger("A");
    expect(owner.status).toBe(200);
    expect((await owner.json()).collections.every((c: { shopId: string }) => c.shopId === "A")).toBe(true);
    expect((await api({ kind: "owner", shopId: "A" }).api.shopLedger("B")).status).toBe(403);
    expect((await api({ kind: "staff", shopId: "A" }).api.shopLedger("A")).status).toBe(403);
    expect((await api({ kind: "guest" }).api.shopLedger("A")).status).toBe(401);
  });

  it("keeps every admin endpoint behind the Platform Admin", async () => {
    const { api: a, s } = api({ kind: "owner", shopId: "A" });
    expect((await a.adminOverview()).status).toBe(403);
    expect((await a.createBatch(post({ shopId: "A" }))).status).toBe(403);
    expect((await a.markPaid(post({ method: "bkash", reference: "TRX1" }), "pB")).status).toBe(403);
    expect((await a.cancel(post({ reason: "nope" }), "pB")).status).toBe(403);
    expect((await a.recordCollection(post({ shopOrderId: "so" }))).status).toBe(403);
    expect(s.calls).toEqual([]);
  });

  it("lets the admin create, pay and cancel payouts, in the standard error shape", async () => {
    const { api: a } = api({ kind: "admin" });
    const created = await a.createBatch(post({ shopId: "A" }));
    expect(created.status).toBe(201);
    expect((await created.json()).payout).toMatchObject({ shopId: "A", net: 97000, status: "pending" });
    expect(await (await a.markPaid(post({ method: "nagad", reference: "N-1" }), "pB")).json()).toEqual({ ok: true });
    const bad = await a.markPaid(post({ method: "nagad" }), "pB");
    expect(bad.status).toBe(422);
    expect(await bad.json()).toMatchObject({ error: { code: "VALIDATION", fields: { reference: expect.any(String) } } });
    expect((await a.recordCollection(post({ shopOrderId: "so1" }))).status).toBe(201);
    const form = new Request("http://x", { method: "POST", headers: { "content-type": "text/plain" }, body: "shopId=A" });
    expect((await a.createBatch(form)).status).toBe(415);
  });
});

describe("payouts.due-check", () => {
  it("emails the admins the collections overdue or due within 2 days", async () => {
    const sendMail = vi.fn(async () => {});
    const until: Date[] = [];
    const result = await runPayoutDueCheck(NOW, config, {
      unpaidDueBefore: async (u) => (until.push(u), [collection("a1", "A", 1), collection("a2", "A", -1), collection("b1", "B", 0.5)]),
      adminEmails: async () => ["admin@x.test"],
      sendMail,
      adminUrl: () => "http://x/admin/payouts",
    });
    expect(until[0]).toEqual(d(2));
    expect(result).toEqual({ overdue: 1, dueSoon: 2, shops: 2, emailed: true });
    const [mail] = sendMail.mock.calls[0] as unknown as [{ to: string[]; subject: string; text: string }];
    expect(mail.subject).toBe("Shop payouts: 1 overdue, 2 due within 2 days");
    expect(mail.text).toContain("Shop A: BD-261017-AAAAA-1, Tk 970 to pay");
  });

  it("sends nothing when nothing is due, and fails (to retry) when the email fails", async () => {
    const sendMail = vi.fn(async () => {});
    expect(await runPayoutDueCheck(NOW, config, { unpaidDueBefore: async () => [], adminEmails: async () => ["a@x"], sendMail, adminUrl: () => "" })).toMatchObject({ emailed: false });
    expect(sendMail).not.toHaveBeenCalled();
    await expect(
      runPayoutDueCheck(NOW, config, {
        unpaidDueBefore: async () => [collection("a2", "A", -1)],
        adminEmails: async () => ["a@x"],
        sendMail: async () => {
          throw new Error("SMTP down");
        },
        adminUrl: () => "",
      }),
    ).rejects.toThrow("SMTP down");
  });
});

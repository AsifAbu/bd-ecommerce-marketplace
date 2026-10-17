import { describe, expect, it, vi } from "vitest";
import { computeHandoverRate, handoverCountdown, isOverdue, runHandoverCheck, sendOverdueAlert, type OverdueAlertDeps, type OverdueAlertFacts } from "./handover";
import { buildTimeline } from "./timeline";

// US-053: the 48 h handover timer (overdue, countdown, the check job and its alerts), the
// handover-rate metric, and the customer timeline.

const NOW = new Date("2026-10-17T06:00:00Z");
const h = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000);

describe("overdue and countdown", () => {
  it("is overdue only before handover and after the deadline", () => {
    expect(isOverdue("placed", h(-1), NOW)).toBe(true);
    expect(isOverdue("packed", h(-0.01), NOW)).toBe(true);
    expect(isOverdue("confirmed", h(1), NOW)).toBe(false);
    expect(isOverdue("placed", NOW, NOW)).toBe(false); // exactly at the deadline is still on time
    for (const s of ["handed_over", "delivered", "cancelled", "refused", "returned"]) expect(isOverdue(s, h(-10), NOW)).toBe(false);
  });

  it("counts down, warns in the last 6 hours, and shows how late", () => {
    expect(handoverCountdown("placed", h(30), NOW)).toMatchObject({ state: "running", label: "1 d 6 h left to hand over" });
    expect(handoverCountdown("confirmed", h(5.5), NOW)).toMatchObject({ state: "due_soon", label: "5 h 30 min left to hand over" });
    expect(handoverCountdown("packed", h(0.25), NOW).label).toBe("15 min left to hand over");
    expect(handoverCountdown("placed", h(-2.5), NOW)).toMatchObject({ state: "overdue", label: "Overdue by 2 h 30 min" });
    expect(handoverCountdown("placed", h(-48), NOW).label).toBe("Overdue by 2 d");
    expect(handoverCountdown("handed_over", h(-2), NOW)).toMatchObject({ state: null, label: null });
  });
});

describe("handover-rate metric (target 95% within 48 h)", () => {
  const row = (o: Partial<{ status: string; due: number; handed: number | null; cancelled: number | null }>) => ({
    status: o.status ?? "handed_over",
    handoverDueAt: h(o.due ?? 0),
    handedOverAt: o.handed === undefined || o.handed === null ? null : h(o.handed),
    cancelledAt: o.cancelled === undefined || o.cancelled === null ? null : h(o.cancelled),
  });

  it("counts on-time and late handovers, overdue waiting orders and late cancellations", () => {
    const rate = computeHandoverRate(
      [
        row({ status: "delivered", due: -10, handed: -20 }), // on time
        row({ status: "handed_over", due: -10, handed: -10 }), // exactly at the deadline: on time
        row({ status: "refused", due: -10, handed: -5 }), // late
        row({ status: "placed", due: -1 }), // waiting past the deadline: late
        row({ status: "confirmed", due: 5 }), // still inside 48 h: pending
        row({ status: "cancelled", due: -10, cancelled: -20 }), // cancelled in time: excluded
        row({ status: "cancelled", due: -10, cancelled: -2 }), // cancelled after the deadline: late
        row({ status: "delivered", due: -10, handed: null }), // older row, no handover time: excluded
      ],
      NOW,
    );
    expect(rate).toEqual({ eligible: 5, onTime: 2, late: 3, pending: 1, excluded: 2, rate: 0.4 });
  });

  it("is null when nothing is decided yet", () => {
    expect(computeHandoverRate([row({ status: "placed", due: 10 })], NOW).rate).toBeNull();
    expect(computeHandoverRate([], NOW)).toMatchObject({ eligible: 0, rate: null });
  });
});

describe("orders.handover-check", () => {
  it("queues one alert per newly overdue shop order and marks it once", async () => {
    const queued: string[] = [];
    const marked = new Set<string>();
    const deps = {
      findNewlyOverdue: vi.fn(async () => [{ id: "so1" }, { id: "so2" }].filter((r) => !marked.has(r.id))),
      enqueueAlert: async (id: string) => queued.push(id),
      markNotified: async (id: string) => (marked.has(id) ? false : (marked.add(id), true)),
    };
    expect(await runHandoverCheck(NOW, deps)).toEqual({ overdue: 2, alerted: 2, failures: [] });
    // The next run finds nothing new: alerts go out once.
    expect(await runHandoverCheck(NOW, deps)).toEqual({ overdue: 0, alerted: 0, failures: [] });
    expect(queued).toEqual(["so1", "so2"]);
    expect(deps.findNewlyOverdue).toHaveBeenCalledWith(NOW, 500);
  });

  it("queues before marking, and one failure doesn't stop the rest (the failed one stays unmarked)", async () => {
    const marked: string[] = [];
    const result = await runHandoverCheck(NOW, {
      findNewlyOverdue: async () => [{ id: "a" }, { id: "b" }, { id: "c" }],
      enqueueAlert: async (id) => {
        if (id === "b") throw new Error("queue down");
      },
      markNotified: async (id) => (marked.push(id), true),
    });
    expect(result.alerted).toBe(2);
    expect(result.failures).toEqual([{ shopOrderId: "b", error: "queue down" }]);
    expect(marked).toEqual(["a", "c"]);
  });

  it("does not count an order another worker marked first", async () => {
    const result = await runHandoverCheck(NOW, { findNewlyOverdue: async () => [{ id: "a" }], enqueueAlert: async () => 1, markNotified: async () => false });
    expect(result).toEqual({ overdue: 1, alerted: 0, failures: [] });
  });
});

describe("orders.notify-overdue", () => {
  const facts: OverdueAlertFacts = {
    id: "so1",
    shopOrderNo: "BD-261015-AAAAA-1",
    shopId: "shop1",
    shopName: "Tech Shop",
    status: "confirmed",
    handoverDueAt: h(-1),
    members: [
      { email: "owner@x.test", phone: "+8801711111111" },
      { email: "staff@x.test", phone: null },
    ],
    adminEmails: ["admin@x.test"],
  };

  function deps(over: Partial<OverdueAlertDeps> = {}) {
    const mails: { to: string[]; subject: string; text: string }[] = [];
    const sms: [string, string][] = [];
    const d: OverdueAlertDeps = {
      load: async () => facts,
      sendMail: async (m) => void mails.push(m),
      sendSms: async (p, t) => void sms.push([p, t]),
      sellerUrl: (shopId, id) => `http://x/seller/${shopId}/orders/${id}`,
      adminUrl: () => "http://x/admin/orders?overdue=1",
      formatTime: () => "17 Oct 2026, 11:00 am",
      ...over,
    };
    return { d, mails, sms };
  }

  it("emails the shop's owner and staff, texts members with a mobile, and emails the admins", async () => {
    const { d, mails, sms } = deps();
    expect(await sendOverdueAlert("so1", d)).toEqual({ sent: ["shop email", "sms +8801711111111", "admin email"] });
    expect(mails[0].to).toEqual(["owner@x.test", "staff@x.test"]);
    expect(mails[0].subject).toContain("BD-261015-AAAAA-1");
    expect(mails[0].text).toContain("http://x/seller/shop1/orders/so1");
    expect(mails[1].to).toEqual(["admin@x.test"]);
    expect(sms).toHaveLength(1);
  });

  it("skips orders handed over or cancelled meanwhile", async () => {
    const { d, mails } = deps({ load: async () => ({ ...facts, status: "handed_over" }) });
    expect(await sendOverdueAlert("so1", d)).toEqual({ sent: [], skipped: "already handed_over" });
    expect(mails).toHaveLength(0);
    expect((await sendOverdueAlert("x", deps({ load: async () => null }).d)).skipped).toBe("not found");
  });

  it("tries every channel and throws when one failed, so the job is retried", async () => {
    const { d, sms } = deps({
      sendMail: async () => {
        throw new Error("SMTP down");
      },
    });
    await expect(sendOverdueAlert("so1", d)).rejects.toThrow(/shop email: SMTP down; admin email: SMTP down/);
    expect(sms).toHaveLength(1);
  });
});

describe("customer timeline", () => {
  it("lists what happened with times and notes, then the next steps", () => {
    const t = buildTimeline({ status: "handed_over", statusChangedAt: h(-1), placedAt: h(-30) }, [
      { action: "hand_over", toStatus: "handed_over", actorRole: "shop_staff", note: "Courier: RedX, tracking: RX1", at: h(-1) },
      { action: "confirm", toStatus: "confirmed", actorRole: "shop_staff", note: null, at: h(-20) },
    ]);
    expect(t.map((e) => [e.label, e.done])).toEqual([
      ["Order placed", true],
      ["Confirmed by the shop", true],
      ["Handed over to the courier", true],
      ["Delivered", false],
    ]);
    expect(t[2].note).toBe("Courier: RedX, tracking: RX1");
  });

  it("says who cancelled", () => {
    const t = buildTimeline({ status: "cancelled", statusChangedAt: NOW, placedAt: h(-2) }, [
      { action: "cancel", toStatus: "cancelled", actorRole: "customer", note: "Ordered twice", at: NOW },
    ]);
    expect(t.map((e) => e.label)).toEqual(["Order placed", "Cancelled by the customer"]);
  });

  it("shows the current status once for orders changed before the lifecycle existed", () => {
    const t = buildTimeline({ status: "delivered", statusChangedAt: h(-5), placedAt: h(-80) }, []);
    expect(t.map((e) => e.label)).toEqual(["Order placed", "Delivered"]);
  });
});

import { describe, expect, it } from "vitest";
import { adminTransition, assertCanReply, closedOnTime, complaintDueAt, ComplaintError, hoursLeft, isOverdue, parseOpenInput, statusAfterReply } from "./rules";
import { sortForQueue, toTicketView, type TicketRowLike } from "./views";

// US-072 and Guidelines 2021: complaints recorded and resolved within 72 h, the customer informed.

const created = new Date("2026-10-15T06:00:00Z");

function caught(fn: () => unknown): ComplaintError {
  try {
    fn();
  } catch (e) {
    if (e instanceof ComplaintError) return e;
    throw e;
  }
  throw new Error("expected a ComplaintError");
}

describe("72 h timer", () => {
  it("is due 72 h after it was opened", () => {
    expect(complaintDueAt(created).toISOString()).toBe("2026-10-18T06:00:00.000Z");
  });

  it("is overdue from the due time while open or in progress, never once resolved or closed", () => {
    const dueAt = complaintDueAt(created);
    expect(isOverdue({ status: "open", dueAt }, new Date("2026-10-18T05:59:59Z"))).toBe(false);
    expect(isOverdue({ status: "open", dueAt }, new Date("2026-10-18T06:00:00Z"))).toBe(true);
    expect(isOverdue({ status: "in_progress", dueAt }, new Date("2026-10-19T00:00:00Z"))).toBe(true);
    expect(isOverdue({ status: "resolved", dueAt }, new Date("2026-10-19T00:00:00Z"))).toBe(false);
    expect(isOverdue({ status: "closed", dueAt }, new Date("2026-10-19T00:00:00Z"))).toBe(false);
  });

  it("measures 'resolved within 72 h' and hours left", () => {
    const dueAt = complaintDueAt(created);
    expect(closedOnTime({ dueAt, resolvedAt: new Date("2026-10-18T06:00:00Z") })).toBe(true);
    expect(closedOnTime({ dueAt, resolvedAt: new Date("2026-10-18T06:00:01Z") })).toBe(false);
    expect(closedOnTime({ dueAt, resolvedAt: null })).toBe(false);
    expect(hoursLeft(dueAt, new Date("2026-10-17T06:30:00Z"))).toBe(23);
    expect(hoursLeft(dueAt, new Date("2026-10-18T08:00:00Z"))).toBe(-2);
  });
});

describe("thread and status", () => {
  it("the first shop or admin answer starts the work; a customer message does not", () => {
    expect(statusAfterReply("open", "shop")).toBe("in_progress");
    expect(statusAfterReply("open", "admin")).toBe("in_progress");
    expect(statusAfterReply("open", "customer")).toBe("open");
    expect(statusAfterReply("in_progress", "shop")).toBe("in_progress");
  });

  it("no replies once resolved or closed", () => {
    expect(caught(() => assertCanReply("resolved")).code).toBe("COMPLAINT_CLOSED");
    expect(() => assertCanReply("in_progress")).not.toThrow();
  });

  it("admin: start only from open; resolve or close only while active", () => {
    expect(adminTransition("open", "start")).toBe("in_progress");
    expect(adminTransition("open", "resolve")).toBe("resolved");
    expect(adminTransition("in_progress", "close")).toBe("closed");
    expect(caught(() => adminTransition("in_progress", "start")).status).toBe(409);
    expect(caught(() => adminTransition("resolved", "close")).code).toBe("COMPLAINT_STATE");
  });

  it("validates the new ticket", () => {
    expect(parseOpenInput({ subject: " Parcel missing ", category: "delivery", message: "It never arrived at my door." })).toEqual({
      subject: "Parcel missing",
      category: "delivery",
      message: "It never arrived at my door.",
    });
    expect(caught(() => parseOpenInput({ subject: "Hi", category: "delivery", message: "It never arrived." })).fields?.subject).toBeDefined();
    expect(caught(() => parseOpenInput({ subject: "Parcel missing", category: "bogus", message: "It never arrived." })).fields?.category).toBeDefined();
    expect(caught(() => parseOpenInput({ subject: "Parcel missing", category: "delivery", message: "short" })).fields?.message).toBeDefined();
  });
});

describe("admin queue view", () => {
  const t = (id: string, status: TicketRowLike["status"], dueAt: string): TicketRowLike => ({
    id,
    ticketNo: `CP-261015-${id}`,
    subject: "S",
    category: "delivery",
    status,
    statusChangedAt: created,
    dueAt: new Date(dueAt),
    overdueAt: null,
    resolvedAt: status === "resolved" ? new Date(dueAt) : null,
    resolution: null,
    createdAt: created,
    updatedAt: created,
    shopId: null,
    order: { orderNo: "BD-261015-AAAAA", contactName: "C" },
    shopOrder: null,
  });

  it("puts overdue first, then by due time, finished last, with an overdue flag", () => {
    const now = new Date("2026-10-18T12:00:00Z");
    const views = ["late", "soon", "later", "done"].map((id) =>
      toTicketView(
        t(id, id === "done" ? "resolved" : "open", { late: "2026-10-18T06:00:00Z", soon: "2026-10-19T06:00:00Z", later: "2026-10-20T06:00:00Z", done: "2026-10-17T06:00:00Z" }[id]!),
        now,
      ),
    );
    const sorted = sortForQueue([views[2], views[3], views[1], views[0]]);
    expect(sorted.map((v) => v.id)).toEqual(["late", "soon", "later", "done"]);
    expect(sorted[0]).toMatchObject({ overdue: true, hoursLeft: -6 });
    expect(sorted[3]).toMatchObject({ overdue: false, hoursLeft: null, resolvedOnTime: true });
  });
});

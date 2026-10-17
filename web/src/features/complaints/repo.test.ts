import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "@/lib/testing/fake-db";

// Complaints data access is scoped (ADR-004): customers see tickets on their own orders, a shop
// only tickets about its shop orders, the admin queue active tickets. The overdue flag is set once.
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  get prisma() {
    return state.db;
  },
}));

const repo = await import("./repo");

type Tables = "complaintTicket" | "complaintMessage" | "order";
let db: ReturnType<typeof createFakeDb<Tables>>;
const due = new Date("2026-10-18T06:00:00Z");

beforeEach(() => {
  db = createFakeDb<Tables>({
    order: [
      { id: "oA", userId: "A" },
      { id: "oB", userId: "B" },
      { id: "oG", userId: "A" }, // a guest order linked to A later
    ],
    complaintTicket: [
      { id: "tA", orderId: "oA", userId: "A", shopId: "s1", status: "open", dueAt: due, overdueAt: null },
      { id: "tB", orderId: "oB", userId: "B", shopId: "s2", status: "in_progress", dueAt: due, overdueAt: null },
      { id: "tG", orderId: "oG", userId: null, shopId: "s1", status: "resolved", dueAt: due, overdueAt: null },
    ],
    complaintMessage: [],
  });
  state.db = db;
});

const ids = (rows: { id?: unknown }[]) => rows.map((r) => String(r.id)).sort();

describe("scoped reads", () => {
  it("a customer sees tickets on own and linked orders only", async () => {
    expect(ids(await repo.listForUser("A"))).toEqual(["tA", "tG"]);
    expect(ids(await repo.listForUser("B"))).toEqual(["tB"]);
    expect(ids(await repo.listForOrder("oB"))).toEqual(["tB"]);
  });

  it("a shop sees only tickets about its own shop orders", async () => {
    expect(ids(await repo.listForShop("s1"))).toEqual(["tA", "tG"]);
    expect(ids(await repo.listForShop("s2"))).toEqual(["tB"]);
    expect(await repo.getDetail({ kind: "shop", shopId: "s2" }, "tA")).toBeNull();
    expect(await repo.find({ kind: "order", orderId: "oB" }, "tA")).toBeNull();
    expect((await repo.find({ kind: "shop", shopId: "s1" }, "tA"))?.id).toBe("tA");
  });

  it("the admin queue holds active tickets by default", async () => {
    expect(ids(await repo.listForAdmin())).toEqual(["tA", "tB"]);
    expect(ids(await repo.listForAdmin({ statuses: ["resolved"] }))).toEqual(["tG"]);
  });
});

describe("timer and writes", () => {
  it("lists overdue active tickets and flags each once", async () => {
    const now = new Date("2026-10-18T07:00:00Z");
    expect(ids(await repo.listOverdue(now, 10))).toEqual(["tA", "tB"]);
    expect(await repo.flagOverdue("tA", now)).toBe(true);
    expect(await repo.flagOverdue("tA", now)).toBe(false);
    expect(await repo.flagOverdue("tG", now)).toBe(false); // resolved
    expect(ids(await repo.listOverdue(now, 10))).toEqual(["tB"]);
    expect(await repo.listOverdue(new Date("2026-10-18T05:00:00Z"), 10)).toEqual([]);
  });

  it("a staff reply moves the ticket to in progress with the message; a closed ticket refuses", async () => {
    const at = new Date("2026-10-16T00:00:00Z");
    await repo.addMessage("tA", { authorRole: "shop", authorId: "staff", text: "Checking", at }, { from: "open", to: "in_progress" });
    expect(db.complaintTicket.rows.find((t) => t.id === "tA")?.status).toBe("in_progress");
    expect(db.complaintMessage.rows).toHaveLength(1);
    await expect(repo.addMessage("tG", { authorRole: "shop", authorId: "staff", text: "Late", at }, { from: "open", to: "in_progress" })).rejects.toMatchObject({ code: "COMPLAINT_CLOSED" });
    expect(db.complaintMessage.rows).toHaveLength(1);
  });

  it("status updates are conditional", async () => {
    expect(await repo.update("tG", ["open", "in_progress"], { status: "closed" })).toBe(false);
    expect(await repo.update("tA", ["open"], { status: "resolved" })).toBe(true);
  });
});

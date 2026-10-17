import { beforeEach, describe, expect, it } from "vitest";
import { ComplaintError, type ComplaintStatus } from "./rules";
import { createComplaintsService, type ComplaintEvent, type ComplaintScope, type ComplaintsStore, type NewTicket } from "./service";

// US-072 through the service with an in-memory store: open with a 72 h due time, thread replies,
// admin resolution, the overdue job (flags once, alerts the admin), the customer informed on each
// status change, and scoping.

type Ticket = NewTicket & { id: string; status: ComplaintStatus; overdueAt: Date | null; resolution?: string; resolvedAt?: Date };

function memoryStore() {
  const tickets: Ticket[] = [];
  const messages: { id: string; ticketId: string; authorRole: string; text: string }[] = [];
  const inScope = (scope: ComplaintScope, t: Ticket) => (scope.kind === "order" ? t.orderId === scope.orderId : scope.kind === "shop" ? t.shopId === scope.shopId : true);
  const store: ComplaintsStore = {
    async orderForComplaint(orderId) {
      if (orderId === "o1") return { id: "o1", orderNo: "BD-261015-AAAAA", contactPhone: "+8801711111111", contactEmail: null, accountEmail: "c@ecom.test", shopOrders: [{ id: "so1", shopId: "s1" }] };
      if (orderId === "o2") return { id: "o2", orderNo: "BD-261015-BBBBB", contactPhone: "+8801722222222", contactEmail: null, accountEmail: null, shopOrders: [{ id: "so2a", shopId: "s1" }, { id: "so2b", shopId: "s2" }] };
      return null;
    },
    async create(ticket, first) {
      const id = `t${tickets.length + 1}`;
      tickets.push({ ...ticket, id, status: "open", overdueAt: null });
      messages.push({ id: `m${messages.length + 1}`, ticketId: id, authorRole: "customer", text: first.text });
      return { id, ticketNo: ticket.ticketNo };
    },
    async find(scope, id) {
      const t = tickets.find((x) => x.id === id && inScope(scope, x));
      return t ? { id: t.id, ticketNo: t.ticketNo, status: t.status, dueAt: t.dueAt, shopId: t.shopId } : null;
    },
    async addMessage(id, msg, move) {
      const t = tickets.find((x) => x.id === id)!;
      if (move && t.status === move.from) t.status = move.to;
      const mid = `m${messages.length + 1}`;
      messages.push({ id: mid, ticketId: id, authorRole: msg.authorRole, text: msg.text });
      return mid;
    },
    async update(id, from, data) {
      const t = tickets.find((x) => x.id === id);
      if (!t || !from.includes(t.status)) return false;
      Object.assign(t, data);
      return true;
    },
    async listOverdue(now) {
      return tickets.filter((t) => (t.status === "open" || t.status === "in_progress") && t.dueAt <= now && !t.overdueAt).map((t) => ({ id: t.id }));
    },
    async flagOverdue(id, now) {
      const t = tickets.find((x) => x.id === id);
      if (!t || t.overdueAt) return false;
      t.overdueAt = now;
      return true;
    },
    async audit() {},
  };
  return { store, tickets, messages };
}

let clock: Date;
let mem: ReturnType<typeof memoryStore>;
let sent: { id: string; event: ComplaintEvent; messageId?: string }[];
let service: ReturnType<typeof createComplaintsService>;

beforeEach(() => {
  clock = new Date("2026-10-15T06:00:00Z");
  mem = memoryStore();
  sent = [];
  service = createComplaintsService({
    store: mem.store,
    now: () => clock,
    newTicketNo: () => `CP-261015-ABCD${mem.tickets.length + 2}`,
    notify: async (id, event, messageId) => {
      sent.push({ id, event, ...(messageId ? { messageId } : {}) });
    },
  });
});

const body = { subject: "Parcel not delivered", category: "delivery", message: "The courier never came to my address." };

async function err(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    if (e instanceof ComplaintError) return e;
    throw e;
  }
  throw new Error("expected a ComplaintError");
}

describe("open", () => {
  it("records the ticket with a 72 h due time, the shop involved and the customer's contact, and informs", async () => {
    const t = await service.open("o1", "u1", body);
    expect(mem.tickets[0]).toMatchObject({ id: t.id, userId: "u1", shopOrderId: "so1", shopId: "s1", contactPhone: "+8801711111111", contactEmail: "c@ecom.test" });
    expect(mem.tickets[0].dueAt.toISOString()).toBe("2026-10-18T06:00:00.000Z");
    expect(mem.messages[0]).toMatchObject({ ticketId: t.id, authorRole: "customer", text: body.message });
    expect(sent).toEqual([{ id: t.id, event: "opened" }]);
  });

  it("takes a shop order only from this order", async () => {
    expect((await err(service.open("o2", null, { ...body, shopOrderId: "so1" }))).fields?.shopOrderId).toBeDefined();
    await service.open("o2", null, { ...body, shopOrderId: "so2b" });
    expect(mem.tickets[0]).toMatchObject({ shopId: "s2", userId: null });
  });

  it("a two-shop order without a shop order goes to the admin only", async () => {
    await service.open("o2", null, body);
    expect(mem.tickets[0].shopId).toBeNull();
  });

  it("needs an order the caller may open", async () => {
    expect((await err(service.open("nope", null, body))).status).toBe(404);
  });
});

describe("thread, status changes and the customer informed", () => {
  it("the shop's first reply moves it to in progress and the customer is informed", async () => {
    const { id } = await service.open("o1", null, body);
    const r = await service.reply({ kind: "shop", shopId: "s1" }, { role: "shop", id: "staff" }, id, "We are checking with the courier.");
    expect(r.status).toBe("in_progress");
    expect(sent.at(-1)).toEqual({ id, event: "reply", messageId: r.messageId });
  });

  it("another shop can't see or answer the ticket; roles must match their scope", async () => {
    const { id } = await service.open("o1", null, body);
    expect((await err(service.reply({ kind: "shop", shopId: "s2" }, { role: "shop", id: "x" }, id, "Hello there"))).status).toBe(404);
    expect((await err(service.reply({ kind: "order", orderId: "o2" }, { role: "customer", id: null }, id, "Hello there"))).status).toBe(404);
    expect((await err(service.reply({ kind: "order", orderId: "o1" }, { role: "admin", id: "x" }, id, "Hello there"))).status).toBe(403);
  });

  it("the admin resolves with a resolution (required); the customer is informed; no replies after", async () => {
    const { id } = await service.open("o1", null, body);
    expect((await err(service.adminUpdate("admin", id, "resolve", ""))).fields?.resolution).toBeDefined();
    clock = new Date("2026-10-16T06:00:00Z");
    await service.adminUpdate("admin", id, "resolve", "Courier redelivered on 16 Oct.");
    expect(mem.tickets[0]).toMatchObject({ status: "resolved", resolution: "Courier redelivered on 16 Oct.", resolvedAt: clock, resolvedById: "admin" });
    expect(sent.at(-1)).toEqual({ id, event: "resolved" });
    expect((await err(service.reply({ kind: "order", orderId: "o1" }, { role: "customer", id: null }, id, "Thanks!"))).code).toBe("COMPLAINT_CLOSED");
    expect((await err(service.adminUpdate("admin", id, "close", "again"))).code).toBe("COMPLAINT_STATE");
  });

  it("start informs the customer too", async () => {
    const { id } = await service.open("o1", null, body);
    await service.adminUpdate("admin", id, "start");
    expect(sent.at(-1)).toEqual({ id, event: "in_progress" });
  });
});

describe("72 h overdue job", () => {
  it("flags a ticket once when it passes 72 h unresolved and alerts the admin", async () => {
    const a = await service.open("o1", null, body);
    const b = await service.open("o1", null, body);
    await service.adminUpdate("admin", b.id, "resolve", "Fixed the same day.");
    clock = new Date("2026-10-18T05:59:00Z");
    expect((await service.flagOverdue()).flagged).toEqual([]);
    clock = new Date("2026-10-18T06:00:00Z");
    expect((await service.flagOverdue()).flagged).toEqual([a.id]);
    expect(mem.tickets[0].overdueAt).toEqual(clock);
    expect(sent.filter((s) => s.event === "overdue")).toEqual([{ id: a.id, event: "overdue" }]);
    clock = new Date("2026-10-19T06:00:00Z");
    expect((await service.flagOverdue()).flagged).toEqual([]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "@/lib/testing/fake-db";

// Reviews data access: customers only reach their own order items and reviews, shops only their
// own shop's reviews (ADR-004), moderation is logged, and every write rewrites the product's
// rating aggregate in the same transaction. Nothing is ever deleted.
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  get prisma() {
    return state.db;
  },
}));

const repo = await import("./repo");

type Tables = "order" | "shopOrder" | "orderItem" | "review" | "productRating" | "shopMember" | "shop";
let db: ReturnType<typeof createFakeDb<Tables>>;

const at = new Date("2026-10-10T10:00:00Z");
const visible = (id: string, over: Record<string, unknown>) => ({
  id,
  status: "visible",
  title: null,
  text: "",
  hiddenReason: null,
  createdAt: at,
  editedAt: null,
  replyText: null,
  ...over,
});

beforeEach(() => {
  db = createFakeDb<Tables>({
    shop: [
      { id: "s1", ownerId: "owner1" },
      { id: "s2", ownerId: "owner2" },
    ],
    shopMember: [
      { id: "m1", shopId: "s1", userId: "owner1", role: "owner" },
      { id: "m2", shopId: "s1", userId: "staff1", role: "staff" },
    ],
    order: [
      { id: "oA", userId: "A" },
      { id: "oB", userId: "B" },
      { id: "oG", userId: null },
    ],
    shopOrder: [
      { id: "soA", orderId: "oA", shopId: "s1", status: "delivered" },
      { id: "soB", orderId: "oB", shopId: "s1", status: "delivered" },
      { id: "soG", orderId: "oG", shopId: "s1", status: "delivered" },
    ],
    orderItem: [
      { id: "iA", shopOrderId: "soA", productId: "p1" },
      { id: "iA2", shopOrderId: "soA", productId: "p2" },
      { id: "iB", shopOrderId: "soB", productId: "p1" },
      { id: "iG", shopOrderId: "soG", productId: "p1" },
    ],
    review: [
      visible("rB", { userId: "B", orderItemId: "iB", productId: "p1", shopId: "s1", rating: 2 }),
      visible("rX", { userId: "X", orderItemId: "iX", productId: "p9", shopId: "s2", rating: 5 }),
    ],
    productRating: [],
  });
  state.db = db;
});

const ids = (rows: { id?: unknown }[]) => rows.map((r) => String(r.id)).sort();
const rating = (productId: string) => db.productRating.rows.find((r) => r.productId === productId);

describe("customer access is scoped by userId", () => {
  it("finds only the user's own order items (never another user's or an unlinked guest's)", async () => {
    expect(await repo.findItemForReview("A", "iA")).not.toBeNull();
    expect(await repo.findItemForReview("A", "iB")).toBeNull();
    expect(await repo.findItemForReview("A", "iG")).toBeNull();
    expect(ids(await repo.findItemsForUser("A", ["iA", "iA2", "iB", "iG"]))).toEqual(["iA", "iA2"]);
  });

  it("finds and lists only the user's own reviews", async () => {
    expect(await repo.findOwnReview("B", "rB")).not.toBeNull();
    expect(await repo.findOwnReview("A", "rB")).toBeNull();
    expect(await repo.findOwnByItem("A", "iB")).toBeNull();
    expect(ids(await repo.listForUser("B"))).toEqual(["rB"]);
    expect(await repo.listForUser("A")).toEqual([]);
  });

  it("an edit of someone else's review changes nothing and logs nothing", async () => {
    const change = { rating: 5, title: null, text: "hijacked" };
    expect(await repo.updateOwnReview("A", "rB", change, change, at)).toBe(false);
    expect(db.review.rows.find((r) => r.id === "rB")).toMatchObject({ rating: 2, text: "" });
    expect(db.auditLog.rows).toEqual([]);
  });

  it("knows which shops the user owns or works for", async () => {
    expect([...(await repo.memberShopIds("staff1", ["s1", "s2"]))]).toEqual(["s1"]);
    expect([...(await repo.memberShopIds("owner2", ["s1", "s2"]))]).toEqual(["s2"]);
    expect([...(await repo.memberShopIds("A", ["s1", "s2"]))]).toEqual([]);
  });
});

describe("writes keep the product rating in step (same transaction)", () => {
  it("creating a review updates the aggregate", async () => {
    await repo.createReview({ userId: "A", orderItemId: "iA", productId: "p1", shopId: "s1", rating: 5, title: "Great", text: "Fast" });
    expect(rating("p1")).toMatchObject({ shopId: "s1", count: 2, total: 7, average: "3.50", stars2: 1, stars5: 1 });
  });

  it("an edit keeps the previous version in the audit log and recounts", async () => {
    const previous = { rating: 2, title: null, text: "" };
    expect(await repo.updateOwnReview("B", "rB", { rating: 4, title: "Better", text: "Works now" }, previous, at)).toBe(true);
    expect(db.review.rows.find((r) => r.id === "rB")).toMatchObject({ rating: 4, text: "Works now", editedAt: at });
    expect(db.auditLog.rows).toEqual([expect.objectContaining({ actorId: "B", action: "review.edited", entityId: "rB", data: expect.objectContaining({ previous }) })]);
    expect(rating("p1")).toMatchObject({ count: 1, total: 4, average: "4.00", stars4: 1, stars2: 0 });
  });

  it("hiding logs the reason, removes the review from the rating; unhiding restores it", async () => {
    expect(await repo.setStatus("rB", "visible", "admin", "Contains a phone number", at)).toBe(true);
    expect(db.review.rows.find((r) => r.id === "rB")).toMatchObject({ status: "hidden", hiddenReason: "Contains a phone number", hiddenById: "admin", hiddenAt: at });
    expect(rating("p1")).toMatchObject({ count: 0, total: 0, average: "0.00" });
    // A second hide (double click) changes and logs nothing.
    expect(await repo.setStatus("rB", "visible", "admin", "again", at)).toBe(false);

    expect(await repo.setStatus("rB", "hidden", "admin", "Phone number was a typo", at)).toBe(true);
    expect(db.review.rows.find((r) => r.id === "rB")).toMatchObject({ status: "visible", hiddenReason: null });
    expect(rating("p1")).toMatchObject({ count: 1, total: 2 });
    expect(db.auditLog.rows.map((r) => [r.action, (r.data as { reason: string }).reason])).toEqual([
      ["review.hidden", "Contains a phone number"],
      ["review.unhidden", "Phone number was a typo"],
    ]);
    expect(db.auditLog.rows[1].data).toMatchObject({ previousReason: "Contains a phone number" });
    // Never deleted.
    expect(db.review.rows).toHaveLength(2);
  });
});

describe("shop access is scoped by shopId", () => {
  it("a shop replies only to reviews of its own products", async () => {
    expect(await repo.setReply("s2", "rB", "Not ours", "owner2", at)).toBe(false);
    expect(db.review.rows.find((r) => r.id === "rB")?.replyText).toBeNull();
    expect(await repo.setReply("s1", "rB", "Sorry, we sent a replacement", "staff1", at)).toBe(true);
    expect(db.review.rows.find((r) => r.id === "rB")).toMatchObject({ replyText: "Sorry, we sent a replacement", replyById: "staff1" });
    expect(db.auditLog.rows).toEqual([expect.objectContaining({ action: "review.replied", entityId: "rB" })]);
  });

  it("lists and counts only the shop's own visible reviews", async () => {
    expect(ids(await repo.listForShop("s1", 0, 10))).toEqual(["rB"]);
    expect(ids(await repo.listForShop("s2", 0, 10))).toEqual(["rX"]);
    expect(await repo.countForShop("s1")).toBe(1);
    await repo.setStatus("rB", "visible", "admin", "Abusive words", at);
    expect(await repo.listForShop("s1", 0, 10)).toEqual([]);
  });

  it("shop rating rows and windows are per shop", async () => {
    await repo.createReview({ userId: "A", orderItemId: "iA", productId: "p1", shopId: "s1", rating: 5, title: null, text: "" });
    expect(await repo.shopRatingRows("s2")).toEqual([]);
    expect(await repo.shopRatingRows("s1")).toHaveLength(1);
    expect(await repo.shopRatingsBetween("s1", new Date(0), new Date("2100-01-01"))).toEqual([2]);
    expect(await repo.shopRatingsBetween("s1", new Date("2026-10-11"), new Date("2100-01-01"))).toEqual([]);
    expect(await repo.shopRatingsBetween("s2", new Date("2027-01-01"), new Date("2100-01-01"))).toEqual([]);
  });
});

describe("public and admin reads", () => {
  it("product pages list only visible reviews of that product", async () => {
    expect(ids(await repo.listVisibleForProduct("p1", 0, 10))).toEqual(["rB"]);
    await repo.setStatus("rB", "visible", "admin", "Abusive words", at);
    expect(await repo.listVisibleForProduct("p1", 0, 10)).toEqual([]);
    expect(await repo.countVisibleForProduct("p1")).toBe(0);
  });

  it("the admin queue filters by status", async () => {
    await repo.setStatus("rB", "visible", "admin", "Abusive words", at);
    expect(ids(await repo.adminList("hidden", 0, 20))).toEqual(["rB"]);
    expect(ids(await repo.adminList("visible", 0, 20))).toEqual(["rX"]);
    expect(await repo.adminCount("hidden")).toBe(1);
  });
});

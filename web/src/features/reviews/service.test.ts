import { describe, expect, it, vi } from "vitest";
import { ReviewError } from "./errors";
import type { ItemRow, ItemStateRow, OwnRow, PublicRow, RatingRow } from "./repo";
import { createReviewService, type AwaitingRow, type ReviewRepo } from "./service";

// US-055 use cases over a fake repository: who can write, edit and moderate, what the product
// page and seller score see, and that search is told about rating changes.

const NOW = new Date("2026-10-17T10:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

const itemRow = (over: Partial<{ userId: string | null; status: string; shopId: string; productShopId: string; reviewId: string | null }> = {}): ItemRow =>
  ({
    id: "oi1",
    productId: "p1",
    title: "[TEST] RAM",
    variantLabel: null,
    shopOrder: {
      shopId: over.shopId ?? "s1",
      status: over.status ?? "delivered",
      shopName: "Tech Shop",
      order: { userId: over.userId === undefined ? "buyer" : over.userId, orderNo: "BD-261005-SEEDA" },
    },
    product: { shopId: over.productShopId ?? "s1" },
    review: over.reviewId ? { id: over.reviewId } : null,
  }) as ItemRow;

const ownRow = (over: Partial<OwnRow> = {}): OwnRow =>
  ({
    id: "r1",
    orderItemId: "oi1",
    productId: "p1",
    rating: 4,
    title: "Good",
    text: "Fast",
    status: "visible",
    hiddenReason: null,
    createdAt: new Date(NOW.getTime() - 5 * DAY),
    editedAt: null,
    replyText: null,
    orderItem: { title: "[TEST] RAM", variantLabel: null },
    ...over,
  }) as OwnRow;

function setup(over: Partial<ReviewRepo> = {}) {
  const repo: ReviewRepo = {
    findItemForReview: vi.fn(async (userId: string) => (userId === "buyer" || userId === "staff" ? itemRow({ userId }) : null)),
    findItemsForUser: vi.fn(async () => []),
    itemsAwaitingReview: vi.fn(async () => []),
    memberShopIds: vi.fn(async (userId: string) => new Set(userId === "staff" ? ["s1"] : [])),
    findOwnReview: vi.fn(async (userId: string, id: string) =>
      userId === "buyer" && id === "r1"
        ? { id: "r1", userId: "buyer", productId: "p1", shopId: "s1", status: "visible" as const, createdAt: new Date(NOW.getTime() - 5 * DAY), rating: 4, title: "Good", text: "Fast" }
        : null,
    ),
    adminFindReview: vi.fn(async (id: string) =>
      id === "r1" ? { id: "r1", userId: "buyer", productId: "p1", shopId: "s1", status: "visible" as const, createdAt: NOW, hiddenReason: null } : null,
    ),
    createReview: vi.fn(async () => ({ id: "rNew", createdAt: NOW })),
    updateOwnReview: vi.fn(async () => true),
    setStatus: vi.fn(async () => true),
    setReply: vi.fn(async (shopId: string) => shopId === "s1"),
    getProductRating: vi.fn(async (): Promise<RatingRow | null> => null),
    listVisibleForProduct: vi.fn(async (): Promise<PublicRow[]> => []),
    countVisibleForProduct: vi.fn(async () => 0),
    listForUser: vi.fn(async () => []),
    findOwnByItem: vi.fn(async () => null),
    listForShop: vi.fn(async () => []),
    countForShop: vi.fn(async () => 0),
    shopRatingRows: vi.fn(async () => []),
    shopRatingsBetween: vi.fn(async () => []),
    adminList: vi.fn(async () => []),
    adminCount: vi.fn(async () => 0),
    reviewsBetween: vi.fn(async () => []),
    ...over,
  };
  const onProductsChanged = vi.fn();
  const svc = createReviewService({ repo, now: () => NOW, onProductsChanged });
  return { svc, repo, onProductsChanged };
}

async function codeOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (err) {
    if (err instanceof ReviewError) return `${err.status} ${err.code}`;
    throw err;
  }
}

const rating = (counts: [number, number, number, number, number]): RatingRow => {
  const count = counts.reduce((a, b) => a + b, 0);
  const total = counts.reduce((a, n, i) => a + n * (i + 1), 0);
  return {
    count,
    total,
    average: { toString: () => (count ? (total / count).toFixed(2) : "0") } as RatingRow["average"],
    stars1: counts[0],
    stars2: counts[1],
    stars3: counts[2],
    stars4: counts[3],
    stars5: counts[4],
  };
};

describe("writing a review", () => {
  it("the buyer reviews a delivered item; search is told about the new rating", async () => {
    const { svc, repo, onProductsChanged } = setup();
    expect(await svc.create("buyer", { orderItemId: "oi1", rating: "5", title: " Great ", text: "Fast delivery" })).toEqual({ id: "rNew", productId: "p1" });
    expect(repo.createReview).toHaveBeenCalledWith({ userId: "buyer", orderItemId: "oi1", productId: "p1", shopId: "s1", rating: 5, title: "Great", text: "Fast delivery" });
    expect(onProductsChanged).toHaveBeenCalledWith(["p1"]);
  });

  it("someone else's item is 404; a staff member of the selling shop is 403; nothing is written", async () => {
    const { svc, repo } = setup();
    expect(await codeOf(svc.create("stranger", { orderItemId: "oi1", rating: 5 }))).toBe("404 NOT_FOUND");
    expect(await codeOf(svc.create("staff", { orderItemId: "oi1", rating: 5 }))).toBe("403 SHOP_MEMBER");
    expect(repo.createReview).not.toHaveBeenCalled();
  });

  it("not before delivery, and only once per item", async () => {
    const notYet = setup({ findItemForReview: vi.fn(async () => itemRow({ status: "handed_over" })) });
    expect(await codeOf(notYet.svc.create("buyer", { orderItemId: "oi1", rating: 4 }))).toBe("409 NOT_DELIVERED");
    const twice = setup({ findItemForReview: vi.fn(async () => itemRow({ reviewId: "r1" })) });
    expect(await codeOf(twice.svc.create("buyer", { orderItemId: "oi1", rating: 4 }))).toBe("409 ALREADY_REVIEWED");
  });

  it("a double submit that loses the unique order-item race is a 409, not a 500", async () => {
    const { svc, onProductsChanged } = setup({ createReview: vi.fn(async () => Promise.reject(Object.assign(new Error("unique"), { code: "P2002" }))) });
    expect(await codeOf(svc.create("buyer", { orderItemId: "oi1", rating: 4 }))).toBe("409 ALREADY_REVIEWED");
    expect(onProductsChanged).not.toHaveBeenCalled();
  });

  it("validates before touching the database", async () => {
    const { svc, repo } = setup();
    expect(await codeOf(svc.create("buyer", { orderItemId: "oi1", rating: 7 }))).toBe("422 VALIDATION");
    expect(repo.findItemForReview).not.toHaveBeenCalled();
  });
});

describe("editing", () => {
  it("merges the change and passes the previous version for the audit log", async () => {
    const { svc, repo, onProductsChanged } = setup();
    await svc.update("buyer", "r1", { rating: 2, text: "Stopped working" });
    expect(repo.updateOwnReview).toHaveBeenCalledWith(
      "buyer",
      "r1",
      { rating: 2, title: "Good", text: "Stopped working" },
      { rating: 4, title: "Good", text: "Fast" },
      NOW,
    );
    expect(onProductsChanged).toHaveBeenCalledWith(["p1"]);
  });

  it("only the author, within 30 days", async () => {
    expect(await codeOf(setup().svc.update("stranger", "r1", { rating: 1 }))).toBe("404 NOT_FOUND");
    const old = setup({
      findOwnReview: vi.fn(async () => ({ id: "r1", userId: "buyer", productId: "p1", shopId: "s1", status: "visible" as const, createdAt: new Date(NOW.getTime() - 31 * DAY), rating: 4, title: null, text: "" })),
    });
    expect(await codeOf(old.svc.update("buyer", "r1", { rating: 1 }))).toBe("409 EDIT_WINDOW_CLOSED");
    expect(old.repo.updateOwnReview).not.toHaveBeenCalled();
  });

  it("a review hidden meanwhile can't be edited", async () => {
    const { svc } = setup({ updateOwnReview: vi.fn(async () => false) });
    expect(await codeOf(svc.update("buyer", "r1", { rating: 1 }))).toBe("409 REVIEW_HIDDEN");
  });
});

describe("moderation (Platform Admin)", () => {
  it("hides with a reason and tells search; the repo logs it", async () => {
    const { svc, repo, onProductsChanged } = setup();
    expect(await svc.hide("admin", "r1", { reason: "Contains a phone number" })).toEqual({ id: "r1", status: "hidden" });
    expect(repo.setStatus).toHaveBeenCalledWith("r1", "visible", "admin", "Contains a phone number", NOW);
    expect(onProductsChanged).toHaveBeenCalledWith(["p1"]);
  });

  it("needs a reason, and an existing review in the right state", async () => {
    const { svc, repo } = setup();
    expect(await codeOf(svc.hide("admin", "r1", { reason: "" }))).toBe("422 VALIDATION");
    expect(await codeOf(svc.hide("admin", "nope", { reason: "Spam link" }))).toBe("404 NOT_FOUND");
    expect(await codeOf(svc.unhide("admin", "r1", { reason: "Was fine" }))).toBe("409 NOT_HIDDEN");
    expect(repo.setStatus).not.toHaveBeenCalled();
  });

  it("unhides a hidden review with a reason", async () => {
    const { svc, repo } = setup({
      adminFindReview: vi.fn(async () => ({ id: "r1", userId: "b", productId: "p1", shopId: "s1", status: "hidden" as const, createdAt: NOW, hiddenReason: "x" })),
    });
    expect(await svc.unhide("admin", "r1", { reason: "Reviewed again: fine" })).toEqual({ id: "r1", status: "visible" });
    expect(repo.setStatus).toHaveBeenCalledWith("r1", "hidden", "admin", "Reviewed again: fine", NOW);
  });
});

describe("shop replies", () => {
  it("only to reviews of the guard-checked shop", async () => {
    const { svc } = setup();
    expect(await svc.reply("s1", "staff", "r1", { text: "Thanks!" })).toEqual({ id: "r1" });
    expect(await codeOf(svc.reply("s2", "owner2", "r1", { text: "Thanks!" }))).toBe("404 NOT_FOUND");
  });
});

describe("what shoppers see", () => {
  it("product rating: average to 1 decimal, count and histogram (5 stars first)", async () => {
    const { svc } = setup({ getProductRating: vi.fn(async () => rating([1, 0, 0, 1, 2])) });
    const view = await svc.productRating("p1");
    expect(view).toMatchObject({ count: 4, average: 3.8 });
    expect(view.histogram).toEqual([
      { stars: 5, count: 2, percent: 50 },
      { stars: 4, count: 1, percent: 25 },
      { stars: 3, count: 0, percent: 0 },
      { stars: 2, count: 0, percent: 0 },
      { stars: 1, count: 1, percent: 25 },
    ]);
    expect((await setup().svc.productRating("p1")).average).toBeNull();
  });

  it("pages visible reviews 10 at a time, with a verified-purchase label and a short name", async () => {
    const row = {
      id: "r1",
      rating: 5,
      title: null,
      text: "Good",
      createdAt: NOW,
      editedAt: null,
      replyText: "Thanks",
      repliedAt: NOW,
      user: { name: "Rahim Karim" },
      orderItem: { variantLabel: "Size: M" },
    } as PublicRow;
    const { svc, repo } = setup({ countVisibleForProduct: vi.fn(async () => 23), listVisibleForProduct: vi.fn(async () => [row]) });
    const page = await svc.productReviews("p1", "3");
    expect(repo.listVisibleForProduct).toHaveBeenCalledWith("p1", 20, 10);
    expect(page).toMatchObject({ page: 3, perPage: 10, total: 23, totalPages: 3 });
    expect(page.reviews[0]).toMatchObject({ author: "Rahim K.", verifiedPurchase: true, variantLabel: "Size: M", reply: { text: "Thanks" } });
    // A bad page number falls back to page 1.
    await svc.productReviews("p1", "-2");
    expect(repo.listVisibleForProduct).toHaveBeenLastCalledWith("p1", 0, 10);
  });
});

describe("order pages and My reviews", () => {
  const stateRow = (id: string, over: Partial<{ status: string; shopId: string; review: ItemStateRow["review"] }> = {}): ItemStateRow =>
    ({
      id,
      productId: "p1",
      shopOrder: { shopId: over.shopId ?? "s1", status: over.status ?? "delivered" },
      product: { shopId: over.shopId ?? "s1" },
      review: over.review ?? null,
    }) as ItemStateRow;

  it("tells each of the user's items what to show", async () => {
    const { svc } = setup({
      findItemsForUser: vi.fn(async () => [
        stateRow("a"),
        stateRow("b", { status: "placed" }),
        stateRow("c", { review: { id: "r1", rating: 4, status: "visible", hiddenReason: null, createdAt: new Date(NOW.getTime() - DAY) } }),
        stateRow("d", { review: { id: "r2", rating: 1, status: "hidden", hiddenReason: "Abuse", createdAt: new Date(NOW.getTime() - DAY) } }),
        stateRow("e", { shopId: "s1" }),
      ]),
      memberShopIds: vi.fn(async () => new Set<string>()),
    });
    const states = await svc.itemStates("buyer", ["a", "b", "c", "d", "e"]);
    expect(states.a).toEqual({ kind: "can_review" });
    expect(states.b).toEqual({ kind: "not_delivered" });
    expect(states.c).toMatchObject({ kind: "reviewed", rating: 4, canEdit: true });
    expect(states.d).toMatchObject({ kind: "reviewed", status: "hidden", canEdit: false });

    const member = setup({ findItemsForUser: vi.fn(async () => [stateRow("a")]), memberShopIds: vi.fn(async () => new Set(["s1"])) });
    expect(await member.svc.itemStates("staff", ["a"])).toEqual({ a: { kind: "shop_member" } });
  });

  it("My reviews leaves out items of the user's own shop", async () => {
    const awaiting = (id: string, shopId: string): AwaitingRow => ({
      id,
      productId: "p",
      title: id,
      variantLabel: null,
      shopOrder: { shopId, shopName: "S", deliveredAt: NOW, order: { orderNo: "BD-1" } },
      product: { shopId },
    });
    const { svc } = setup({
      itemsAwaitingReview: vi.fn(async () => [awaiting("mine", "s1"), awaiting("theirs", "s2")]),
      memberShopIds: vi.fn(async () => new Set(["s1"])),
      listForUser: vi.fn(async () => [ownRow({ createdAt: new Date(NOW.getTime() - 40 * DAY) })]),
    });
    const res = await svc.myReviews("staff");
    expect(res.awaiting.map((a) => a.orderItemId)).toEqual(["theirs"]);
    expect(res.reviews[0]).toMatchObject({ id: "r1", canEdit: false });
  });

  it("the write page: create, edit or locked with the reason", async () => {
    expect((await setup().svc.writeContext("buyer", "oi1"))?.mode).toBe("create");
    expect(await setup().svc.writeContext("stranger", "oi1")).toBeNull();
    expect(await setup().svc.writeContext("staff", "oi1")).toMatchObject({ mode: "locked", blocked: { code: "SHOP_MEMBER" } });
    const edit = setup({ findItemForReview: vi.fn(async () => itemRow({ reviewId: "r1" })), findOwnByItem: vi.fn(async () => ownRow()) });
    expect(await edit.svc.writeContext("buyer", "oi1")).toMatchObject({ mode: "edit", review: { id: "r1", canEdit: true } });
    const notYet = setup({ findItemForReview: vi.fn(async () => itemRow({ status: "confirmed" })) });
    expect(await notYet.svc.writeContext("buyer", "oi1")).toMatchObject({ mode: "locked", blocked: { code: "NOT_DELIVERED" } });
  });
});

describe("for the seller score (US-059) and metrics (US-083)", () => {
  it("shop rating combines the product aggregates, or counts a time window", async () => {
    const { svc, repo } = setup({
      shopRatingRows: vi.fn(async () => [rating([0, 0, 0, 0, 2]), rating([0, 1, 0, 0, 0])]),
      shopRatingsBetween: vi.fn(async () => [5, 3]),
    });
    expect(await svc.shopRating("s1")).toMatchObject({ count: 3, average: 4 });
    const from = new Date("2026-07-01");
    expect(await svc.shopRating("s1", { from })).toMatchObject({ count: 2, average: 4 });
    expect(repo.shopRatingsBetween).toHaveBeenCalledWith("s1", from, NOW);
  });

  it("metrics count written, visible and hidden reviews and the visible average", async () => {
    const { svc } = setup({
      reviewsBetween: vi.fn(async () => [
        { rating: 5, status: "visible" as const },
        { rating: 4, status: "visible" as const },
        { rating: 1, status: "hidden" as const },
      ]),
    });
    expect(await svc.metrics({ from: new Date(0), to: NOW })).toEqual({ written: 3, visible: 2, hidden: 1, averageRating: 4.5 });
  });
});

import { describe, expect, it } from "vitest";
import { ReviewError } from "./errors";
import {
  assertCanEdit,
  assertCanHide,
  assertCanReview,
  assertCanUnhide,
  canEdit,
  cleanText,
  combine,
  createReviewSchema,
  displayRating,
  EDIT_WINDOW_DAYS,
  editableUntil,
  notDeletable,
  parseInput,
  reasonSchema,
  replySchema,
  reviewEligibility,
  reviewerName,
  summarize,
  updateReviewSchema,
  type ItemFacts,
  type ReviewFacts,
} from "./rules";

const DAY = 24 * 60 * 60 * 1000;

const item = (over: Partial<ItemFacts> = {}): ItemFacts => ({
  orderItemId: "oi1",
  productId: "p1",
  shopId: "s1",
  productShopId: "s1",
  orderUserId: "buyer",
  shopOrderStatus: "delivered",
  reviewId: null,
  ...over,
});

const none = new Set<string>();

function codeOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (err) {
    if (err instanceof ReviewError) return `${err.status} ${err.code}`;
    throw err;
  }
}

describe("who can review an order item (US-055)", () => {
  it("the buyer can review a delivered item", () => {
    expect(reviewEligibility(item(), "buyer", none)).toEqual({ ok: true });
    expect(codeOf(() => assertCanReview(item(), "buyer", none))).toBeNull();
  });

  it("also after a return (the item was delivered first)", () => {
    expect(reviewEligibility(item({ shopOrderStatus: "returned" }), "buyer", none).ok).toBe(true);
  });

  it.each(["placed", "confirmed", "packed", "handed_over", "cancelled", "refused"])("not while the shop order is %s", (status) => {
    expect(reviewEligibility(item({ shopOrderStatus: status }), "buyer", none)).toMatchObject({ ok: false, status: 409, code: "NOT_DELIVERED" });
  });

  it("only the buyer: someone else's item, a missing item and an unlinked guest order are all 404", () => {
    expect(reviewEligibility(item(), "someone-else", none)).toMatchObject({ ok: false, status: 404, code: "NOT_FOUND" });
    expect(reviewEligibility(null, "buyer", none)).toMatchObject({ status: 404 });
    expect(reviewEligibility(item({ orderUserId: null }), "buyer", none)).toMatchObject({ status: 404 });
  });

  it("a guest order linked to the account (US-009) counts as the buyer's", () => {
    // Linking sets order.user_id; the rules only see the account it belongs to now.
    expect(reviewEligibility(item({ orderUserId: "buyer" }), "buyer", none).ok).toBe(true);
  });

  it("blocks owners and staff of the shop that sold it, even for their own delivered order", () => {
    expect(reviewEligibility(item(), "buyer", new Set(["s1"]))).toMatchObject({ ok: false, status: 403, code: "SHOP_MEMBER" });
    // The product's shop counts too (product matching may list it elsewhere later).
    expect(reviewEligibility(item({ productShopId: "s9" }), "buyer", new Set(["s9"]))).toMatchObject({ code: "SHOP_MEMBER" });
    // Membership of an unrelated shop is fine.
    expect(reviewEligibility(item(), "buyer", new Set(["other"])).ok).toBe(true);
  });

  it("one review per order item", () => {
    expect(reviewEligibility(item({ reviewId: "r1" }), "buyer", none)).toMatchObject({ ok: false, status: 409, code: "ALREADY_REVIEWED" });
    expect(codeOf(() => assertCanReview(item({ reviewId: "r1" }), "buyer", none))).toBe("409 ALREADY_REVIEWED");
  });
});

describe("review input", () => {
  it("needs a whole-star rating from 1 to 5; title and text are optional and tidied", () => {
    expect(parseInput(createReviewSchema, { orderItemId: "oi1", rating: "4", title: "  Good  ", text: " Fast\r\n\r\n\r\n\r\nquiet  " })).toEqual({
      orderItemId: "oi1",
      rating: 4,
      title: "Good",
      text: "Fast\n\nquiet",
    });
    expect(parseInput(createReviewSchema, { orderItemId: "oi1", rating: 5 })).toEqual({ orderItemId: "oi1", rating: 5, title: "", text: "" });
    for (const rating of [0, 6, 3.5, "", "abc", null, undefined]) {
      expect(codeOf(() => parseInput(createReviewSchema, { orderItemId: "oi1", rating })), String(rating)).toBe("422 VALIDATION");
    }
  });

  it("limits the title and text length, with field messages", () => {
    try {
      parseInput(createReviewSchema, { orderItemId: "oi1", rating: 3, title: "x".repeat(101), text: "y".repeat(2001) });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ReviewError);
      expect((err as ReviewError).fields).toEqual({
        title: "The title can be at most 100 characters",
        text: "The review can be at most 2000 characters",
      });
    }
  });

  it("an edit changes at least one field", () => {
    expect(codeOf(() => parseInput(updateReviewSchema, {}))).toBe("422 VALIDATION");
    expect(parseInput(updateReviewSchema, { text: "Better now" })).toEqual({ text: "Better now" });
  });

  it("moderation needs a reason; a reply needs text", () => {
    expect(codeOf(() => parseInput(reasonSchema, { reason: " ab " }))).toBe("422 VALIDATION");
    expect(parseInput(reasonSchema, { reason: " Contains a phone number " })).toEqual({ reason: "Contains a phone number" });
    expect(codeOf(() => parseInput(replySchema, { text: "   " }))).toBe("422 VALIDATION");
  });

  it("cleanText keeps single line breaks", () => {
    expect(cleanText("a  b\n c\n\n\n\nd")).toBe("a b\nc\n\nd");
  });
});

describe("editing: the author, for 30 days, never after hiding (decision)", () => {
  const created = new Date("2026-10-01T10:00:00Z");
  const review = (over: Partial<ReviewFacts> = {}): ReviewFacts => ({ id: "r1", userId: "buyer", productId: "p1", shopId: "s1", status: "visible", createdAt: created, ...over });

  it(`allows edits until ${EDIT_WINDOW_DAYS} days after writing`, () => {
    expect(editableUntil(created).toISOString()).toBe("2026-10-31T10:00:00.000Z");
    expect(canEdit(review(), new Date(created.getTime() + 29 * DAY))).toBe(true);
    expect(canEdit(review(), editableUntil(created))).toBe(true);
    expect(codeOf(() => assertCanEdit(review(), "buyer", none, new Date(created.getTime() + 29 * DAY)))).toBeNull();
    expect(codeOf(() => assertCanEdit(review(), "buyer", none, new Date(created.getTime() + 30 * DAY + 1)))).toBe("409 EDIT_WINDOW_CLOSED");
  });

  it("only the author (others get 404)", () => {
    expect(codeOf(() => assertCanEdit(review(), "someone-else", none, created))).toBe("404 NOT_FOUND");
    expect(codeOf(() => assertCanEdit(null, "buyer", none, created))).toBe("404 NOT_FOUND");
  });

  it("not a hidden review, and not once the author works for the shop", () => {
    expect(codeOf(() => assertCanEdit(review({ status: "hidden" }), "buyer", none, created))).toBe("409 REVIEW_HIDDEN");
    expect(canEdit(review({ status: "hidden" }), created)).toBe(false);
    expect(codeOf(() => assertCanEdit(review(), "buyer", new Set(["s1"]), created))).toBe("403 SHOP_MEMBER");
  });

  it("reviews can never be deleted", () => {
    const err = notDeletable();
    expect(err).toMatchObject({ status: 405, code: "REVIEW_NOT_DELETABLE" });
  });
});

describe("moderation", () => {
  const review: ReviewFacts = { id: "r1", userId: "u", productId: "p", shopId: "s", status: "visible", createdAt: new Date() };
  it("hides a visible review once; unhides only a hidden one", () => {
    expect(codeOf(() => assertCanHide(review))).toBeNull();
    expect(codeOf(() => assertCanHide({ ...review, status: "hidden" }))).toBe("409 ALREADY_HIDDEN");
    expect(codeOf(() => assertCanHide(null))).toBe("404 NOT_FOUND");
    expect(codeOf(() => assertCanUnhide({ ...review, status: "hidden" }))).toBeNull();
    expect(codeOf(() => assertCanUnhide(review))).toBe("409 NOT_HIDDEN");
  });
});

describe("aggregates", () => {
  it("summarises star ratings into count, total, average and histogram", () => {
    expect(summarize([5, 4, 4, 1])).toEqual({ count: 4, total: 14, average: 3.5, stars: [1, 0, 0, 2, 1] });
    expect(summarize([5, 4, 4])).toMatchObject({ average: 4.33 });
    expect(summarize([])).toEqual({ count: 0, total: 0, average: 0, stars: [0, 0, 0, 0, 0] });
    // Out-of-range values (never stored) are ignored rather than skewing the average.
    expect(summarize([5, 9, 0])).toMatchObject({ count: 1, average: 5 });
  });

  it("combines product aggregates into a shop rating", () => {
    const a = summarize([5, 5]);
    const b = summarize([2]);
    expect(combine([a, b])).toEqual({ count: 3, total: 12, average: 4, stars: [0, 1, 0, 0, 2] });
    expect(combine([])).toMatchObject({ count: 0, average: 0 });
  });

  it("shows the average to 1 decimal, or null without reviews", () => {
    expect(displayRating({ count: 3, average: 4.33 })).toBe(4.3);
    expect(displayRating({ count: 2, average: 4.75 })).toBe(4.8);
    expect(displayRating({ count: 0, average: 0 })).toBeNull();
  });
});

describe("reviewer name", () => {
  it("shows the first name and the next word's initial, without test tags", () => {
    expect(reviewerName("Rahim Karim Uddin")).toBe("Rahim K.");
    expect(reviewerName("[TEST] Customer, verified phone")).toBe("Customer V.");
    expect(reviewerName("Nusrat")).toBe("Nusrat");
    expect(reviewerName(null)).toBe("Customer");
    expect(reviewerName("  ")).toBe("Customer");
  });
});

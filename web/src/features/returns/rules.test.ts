import { describe, expect, it } from "vitest";
import { ReturnError } from "./errors";
import {
  allowedReasons,
  assertCanDispute,
  assertCanRequest,
  CHANGE_OF_MIND_NOT_ALLOWED,
  EXCLUDED_ITEM,
  isFullyReturned,
  isShopOverdue,
  MEDICINE_EXCLUSION,
  nextStatus,
  refundLimit,
  returnableQuantity,
  returnOptions,
  shopDueAt,
  splitRefund,
  type ExistingReturn,
  type ItemReturnFacts,
} from "./rules";

// US-070 / US-071 acceptance criteria and the Return and Refund policy, as pure rules.

// Delivered on 10 Oct 2026, 15:00 in Dhaka (09:00 UTC).
const deliveredAt = new Date("2026-10-10T09:00:00Z");
const delivered = { status: "delivered", deliveredAt };
const shirt: ItemReturnFacts = { quantity: 2, returnEligibility: "change_of_mind", medicine: false };
const ram: ItemReturnFacts = { quantity: 1, returnEligibility: "eligible", medicine: false };
const paracetamol: ItemReturnFacts = { quantity: 3, returnEligibility: "eligible", medicine: true };
const dhaka = (local: string) => new Date(`${local}+06:00`);

function caught(fn: () => void): ReturnError {
  try {
    fn();
  } catch (err) {
    if (err instanceof ReturnError) return err;
    throw err;
  }
  throw new Error("expected a ReturnError");
}

describe("7-day window (Dhaka dates)", () => {
  it("accepts a request on the 7th day after delivery, up to 23:59 Dhaka time", () => {
    const ask = { quantity: 1, reason: "damaged" as const, details: null };
    expect(() => assertCanRequest(delivered, ram, [], ask, dhaka("2026-10-17T23:59:00"))).not.toThrow();
  });

  it("blocks a delivery 8 days ago with the 7-day policy message", () => {
    const err = caught(() => assertCanRequest(delivered, ram, [], { quantity: 1, reason: "damaged", details: null }, dhaka("2026-10-18T00:01:00")));
    expect(err.status).toBe(422);
    expect(err.code).toBe("RETURN_WINDOW_CLOSED");
    expect(err.message).toBe(
      "Returns are accepted within 7 days of delivery (Return and Refund policy). This item was delivered on 10 Oct 2026, so the last day to ask was 17 Oct 2026.",
    );
  });

  it("counts Bangladesh calendar days, not UTC: delivered at 01:00 Dhaka on 10 Oct (19:00 UTC on the 9th)", () => {
    const early = { status: "delivered", deliveredAt: dhaka("2026-10-10T01:00:00") };
    expect(returnOptions(early, ram, [], dhaka("2026-10-17T22:00:00")).blocked).toBeNull();
    expect(returnOptions(early, ram, [], dhaka("2026-10-18T00:00:00")).blocked?.code).toBe("RETURN_WINDOW_CLOSED");
  });

  it("needs a delivered shop order", () => {
    const err = caught(() => assertCanRequest({ status: "handed_over", deliveredAt: null }, ram, [], { quantity: 1, reason: "damaged", details: null }, deliveredAt));
    expect(err.code).toBe("NOT_DELIVERED");
  });
});

describe("eligibility (return_eligibility snapshot, medicine)", () => {
  const now = dhaka("2026-10-12T10:00:00");

  it("blocks a medicine item that is not damaged or wrong with the exclusion reason", () => {
    for (const reason of ["not_as_described", "change_of_mind", "other"] as const) {
      const err = caught(() => assertCanRequest(delivered, paracetamol, [], { quantity: 1, reason, details: "Changed my mind about it" }, now));
      expect(err.code).toBe("RETURN_NOT_ELIGIBLE");
      expect(err.message).toBe(MEDICINE_EXCLUSION);
      expect(err.fields?.reason).toBe(MEDICINE_EXCLUSION);
    }
  });

  it("accepts damaged or wrong medicine", () => {
    expect(() => assertCanRequest(delivered, paracetamol, [], { quantity: 3, reason: "damaged", details: null }, now)).not.toThrow();
    expect(() => assertCanRequest(delivered, paracetamol, [], { quantity: 1, reason: "wrong_item", details: null }, now)).not.toThrow();
  });

  it("medicine stays excluded even when the listing says change of mind", () => {
    expect(allowedReasons({ returnEligibility: "change_of_mind", medicine: true }).reasons).toEqual(["damaged", "wrong_item"]);
  });

  it("an excluded listing takes only damaged or wrong items", () => {
    const item = { quantity: 1, returnEligibility: "excluded" as const, medicine: false };
    expect(allowedReasons(item)).toEqual({ reasons: ["damaged", "wrong_item"], limitedBecause: EXCLUDED_ITEM });
    expect(caught(() => assertCanRequest(delivered, item, [], { quantity: 1, reason: "not_as_described", details: null }, now)).message).toBe(EXCLUDED_ITEM);
  });

  it("change of mind only when the listing allows it", () => {
    expect(() => assertCanRequest(delivered, shirt, [], { quantity: 1, reason: "change_of_mind", details: null }, now)).not.toThrow();
    const err = caught(() => assertCanRequest(delivered, ram, [], { quantity: 1, reason: "change_of_mind", details: null }, now));
    expect(err.message).toBe(CHANGE_OF_MIND_NOT_ALLOWED);
  });

  it("an unknown eligibility (older rows) is treated as returnable without change of mind", () => {
    expect(allowedReasons({ returnEligibility: null, medicine: false }).reasons).toEqual(["damaged", "wrong_item", "not_as_described", "other"]);
  });

  it("'something else' needs details", () => {
    const err = caught(() => assertCanRequest(delivered, ram, [], { quantity: 1, reason: "other", details: "bad" }, now));
    expect(err.fields?.details).toBeDefined();
  });
});

describe("quantity and one open request per item", () => {
  const now = dhaka("2026-10-12T10:00:00");
  const r = (status: ExistingReturn["status"], quantity = 1): ExistingReturn => ({ status, quantity });

  it("allows at most bought minus already returned (cancelled, rejected and denied do not count)", () => {
    expect(returnableQuantity(shirt, [r("refunded"), r("cancelled"), r("denied")])).toBe(1);
    const err = caught(() => assertCanRequest(delivered, shirt, [r("refunded")], { quantity: 2, reason: "damaged", details: null }, now));
    expect(err.code).toBe("RETURN_QUANTITY");
    expect(err.fields?.quantity).toBe("You can return 1 to 1 of this item.");
    expect(() => assertCanRequest(delivered, shirt, [r("refunded")], { quantity: 1, reason: "damaged", details: null }, now)).not.toThrow();
    expect(caught(() => assertCanRequest(delivered, ram, [], { quantity: 0, reason: "damaged", details: null }, now)).code).toBe("RETURN_QUANTITY");
  });

  it("blocks a second request while one is open", () => {
    for (const status of ["requested", "accepted", "escalated", "approved", "received"] as const) {
      expect(caught(() => assertCanRequest(delivered, shirt, [r(status)], { quantity: 1, reason: "damaged", details: null }, now)).code).toBe("RETURN_ALREADY_OPEN");
    }
  });

  it("after a rejection the customer disputes instead of asking again; a denial is final", () => {
    expect(returnOptions(delivered, shirt, [r("rejected")], now).blocked?.code).toBe("RETURN_REJECTED");
    expect(returnOptions(delivered, shirt, [r("denied")], now).blocked?.code).toBe("RETURN_DENIED");
    expect(returnOptions(delivered, shirt, [r("cancelled")], now).blocked).toBeNull();
  });

  it("blocks when every unit is already returned", () => {
    expect(returnOptions(delivered, ram, [r("refunded")], now).blocked?.code).toBe("RETURN_QUANTITY");
  });
});

describe("48 h shop answer and transitions", () => {
  it("is due 48 h after the request and overdue only while still requested", () => {
    const at = new Date("2026-10-12T04:00:00Z");
    const due = shopDueAt(at);
    expect(due.toISOString()).toBe("2026-10-14T04:00:00.000Z");
    expect(isShopOverdue({ status: "requested", shopDueAt: due }, new Date("2026-10-14T03:59:59Z"))).toBe(false);
    expect(isShopOverdue({ status: "requested", shopDueAt: due }, new Date("2026-10-14T04:00:00Z"))).toBe(true);
    expect(isShopOverdue({ status: "accepted", shopDueAt: due }, new Date("2026-10-20T00:00:00Z"))).toBe(false);
  });

  it("follows requested -> accepted/rejected -> escalated -> approved/denied -> received -> refunded", () => {
    expect(nextStatus("requested", "accept")).toBe("accepted");
    expect(nextStatus("requested", "reject")).toBe("rejected");
    expect(nextStatus("requested", "escalate")).toBe("escalated");
    expect(nextStatus("rejected", "dispute")).toBe("escalated");
    expect(nextStatus("escalated", "approve")).toBe("approved");
    expect(nextStatus("escalated", "deny")).toBe("denied");
    expect(nextStatus("approved", "receive")).toBe("received");
    expect(nextStatus("received", "refund")).toBe("refunded");
    expect(nextStatus("accepted", "refund")).toBe("refunded");
  });

  it("refuses moves from the wrong status with 409", () => {
    expect(caught(() => nextStatus("accepted", "reject")).status).toBe(409);
    expect(caught(() => nextStatus("refunded", "refund")).code).toBe("RETURN_STATE");
    expect(caught(() => nextStatus("rejected", "refund")).code).toBe("RETURN_STATE");
    expect(caught(() => nextStatus("requested", "approve")).code).toBe("RETURN_STATE");
    expect(caught(() => nextStatus("accepted", "cancel")).code).toBe("RETURN_STATE");
  });

  it("lets a rejection be disputed for 7 days", () => {
    const answered = new Date("2026-10-12T00:00:00Z");
    expect(() => assertCanDispute({ status: "rejected", shopRespondedAt: answered }, new Date("2026-10-18T23:00:00Z"))).not.toThrow();
    expect(caught(() => assertCanDispute({ status: "rejected", shopRespondedAt: answered }, new Date("2026-10-19T01:00:00Z"))).code).toBe("DISPUTE_WINDOW_CLOSED");
  });
});

describe("refunds", () => {
  it("refunds the item price, plus the delivery charge once when the shop is at fault", () => {
    expect(refundLimit({ unitPrice: "1850.00", quantity: 2, reason: "damaged", deliveryCharge: "70.00", deliveryAlreadyRefunded: false })).toEqual({
      items: "3700.00",
      delivery: "70.00",
      max: "3770.00",
    });
    expect(refundLimit({ unitPrice: "1850.00", quantity: 1, reason: "change_of_mind", deliveryCharge: "70.00", deliveryAlreadyRefunded: false }).max).toBe("1850.00");
    expect(refundLimit({ unitPrice: "1850.00", quantity: 1, reason: "wrong_item", deliveryCharge: "70.00", deliveryAlreadyRefunded: true }).max).toBe("1850.00");
  });

  it("splits the amount into items and delivery and refuses more than the limit", () => {
    const limit = refundLimit({ unitPrice: "250.00", quantity: 1, reason: "damaged", deliveryCharge: "70.00", deliveryAlreadyRefunded: false });
    expect(splitRefund(320, limit)).toEqual({ amount: "320.00", delivery: "70.00" });
    expect(splitRefund(200, limit)).toEqual({ amount: "200.00", delivery: "0.00" });
    expect(caught(() => splitRefund(320.01, limit)).fields?.amount).toBe("Enter an amount between Tk 0.01 and Tk 320.00.");
    expect(caught(() => splitRefund(0, limit)).code).toBe("VALIDATION");
    expect(caught(() => splitRefund(Number.NaN, limit)).code).toBe("VALIDATION");
  });

  it("marks a shop order returned only when every unit of every item is refunded", () => {
    expect(isFullyReturned([{ quantity: 2, refundedQuantity: 2 }, { quantity: 1, refundedQuantity: 1 }])).toBe(true);
    expect(isFullyReturned([{ quantity: 2, refundedQuantity: 1 }])).toBe(false);
    expect(isFullyReturned([])).toBe(false);
  });
});

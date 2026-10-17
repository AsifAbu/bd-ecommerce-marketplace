import { describe, expect, it } from "vitest";
import type { ShopOrderStatus } from "../config";
import { OrderError } from "../errors";
import { actorAllowed, availableActions, LIFECYCLE_ACTIONS, loadLifecycleConfig, parseAction, planTransition, type ActorRole, type LifecycleAction } from "./machine";

// US-053: every transition rule of the shop-order lifecycle (status, actor, required input,
// timestamps, restock).

const NOW = new Date("2026-10-17T06:00:00Z");
const TEST = { shopMarksDelivery: true };
const PROD = { shopMarksDelivery: false };
const STATUSES: ShopOrderStatus[] = ["placed", "confirmed", "packed", "handed_over", "delivered", "cancelled", "refused", "returned"];
const ROLES: ActorRole[] = ["shop_owner", "shop_staff", "customer", "admin", "system"];

const plan = (status: ShopOrderStatus, action: LifecycleAction, actor: ActorRole = "shop_staff", input = {}, config = TEST) =>
  planTransition({ status, action, actor, input, now: NOW, config });

function errorOf(fn: () => unknown): OrderError {
  try {
    fn();
  } catch (err) {
    if (err instanceof OrderError) return err;
    throw err;
  }
  throw new Error("expected an OrderError");
}

describe("the happy path: placed -> confirmed -> packed -> handed_over -> delivered", () => {
  it("confirms, packs, hands over (courier + tracking) and delivers with a timestamp each", () => {
    const c = plan("placed", "confirm");
    expect(c.to).toBe("confirmed");
    expect(c.patch).toEqual({ status: "confirmed", statusChangedAt: NOW, confirmedAt: NOW });
    expect(plan("confirmed", "pack").patch).toEqual({ status: "packed", statusChangedAt: NOW, packedAt: NOW });
    const h = plan("packed", "hand_over", "shop_owner", { courierName: "  RedX ", trackingNo: "RX-123456" });
    expect(h.patch).toEqual({ status: "handed_over", statusChangedAt: NOW, handedOverAt: NOW, courierName: "RedX", trackingNo: "RX-123456" });
    expect(h.note).toBe("Courier: RedX, tracking: RX-123456");
    const d = plan("handed_over", "deliver");
    expect(d.patch).toEqual({ status: "delivered", statusChangedAt: NOW, deliveredAt: NOW });
    expect([c, h, d].every((p) => p.restock === false)).toBe(true);
  });

  it("never skips a step", () => {
    expect(errorOf(() => plan("placed", "pack")).code).toBe("INVALID_TRANSITION");
    expect(errorOf(() => plan("placed", "hand_over", "shop_staff", { courierName: "RedX", trackingNo: "123" })).status).toBe(409);
    expect(errorOf(() => plan("confirmed", "hand_over", "shop_staff", { courierName: "RedX", trackingNo: "123" })).code).toBe("INVALID_TRANSITION");
    expect(errorOf(() => plan("packed", "deliver")).code).toBe("INVALID_TRANSITION");
    expect(errorOf(() => plan("confirmed", "confirm")).code).toBe("INVALID_TRANSITION");
  });

  it("needs the courier name and tracking number at handover", () => {
    const err = errorOf(() => plan("packed", "hand_over", "shop_staff", { courierName: "", trackingNo: "" }));
    expect(err.status).toBe(422);
    expect(err.fields).toHaveProperty("courierName");
    expect(errorOf(() => plan("packed", "hand_over", "shop_staff", { courierName: "RedX", trackingNo: " " })).fields).toHaveProperty("trackingNo");
    expect(errorOf(() => plan("packed", "hand_over", "shop_staff", { courierName: "RedX", trackingNo: "x".repeat(61) })).fields).toHaveProperty("trackingNo");
  });
});

describe("refused deliveries and returns", () => {
  it("marks refused with an optional note and does NOT restock (the parcel is still with the courier)", () => {
    const r = plan("handed_over", "refuse", "shop_staff", { reason: "Customer not home, refused on call" });
    expect(r.patch).toMatchObject({ status: "refused", refusedAt: NOW, refusalNote: "Customer not home, refused on call" });
    expect(r.restock).toBe(false);
    expect(plan("handed_over", "refuse").patch.refusalNote).toBeNull();
  });

  it("restocks when the refused parcel is marked returned (by the shop)", () => {
    const r = plan("refused", "mark_returned", "shop_owner");
    expect(r.to).toBe("returned");
    expect(r.restock).toBe(true);
    expect(r.patch).toMatchObject({ status: "returned", returnedAt: NOW, restockedAt: NOW });
  });

  it("closes a delivered order as returned only through the returns flow or the admin, restocking only when asked", () => {
    expect(errorOf(() => plan("delivered", "mark_returned", "shop_owner")).status).toBe(403);
    expect(errorOf(() => plan("delivered", "mark_returned", "customer")).status).toBe(403);
    expect(plan("delivered", "mark_returned", "system").restock).toBe(false);
    expect(plan("delivered", "mark_returned", "system", { restock: true }).restock).toBe(true);
    expect(plan("delivered", "mark_returned", "admin", { restock: "true" }).patch.restockedAt).toEqual(NOW);
  });

  it("lets shop staff mark delivered/refused only while there is no courier feed (test mode); the admin always", () => {
    expect(errorOf(() => plan("handed_over", "deliver", "shop_staff", {}, PROD)).status).toBe(403);
    expect(errorOf(() => plan("handed_over", "refuse", "shop_owner", {}, PROD)).message).toMatch(/courier or the Platform Admin/);
    expect(plan("handed_over", "deliver", "admin", {}, PROD).to).toBe("delivered");
    expect(plan("handed_over", "refuse", "system", {}, PROD).to).toBe("refused");
    expect(errorOf(() => plan("handed_over", "deliver", "customer")).status).toBe(403);
  });
});

describe("cancellation (free until handover)", () => {
  it("lets the shop cancel placed, confirmed or packed orders with a reason, and restocks", () => {
    for (const status of ["placed", "confirmed", "packed"] as const) {
      const c = plan(status, "cancel", "shop_staff", { reason: "Out of stock at the warehouse" });
      expect(c.to).toBe("cancelled");
      expect(c.restock).toBe(true);
      expect(c.patch).toMatchObject({ cancelledAt: NOW, cancelledBy: "shop", cancelReason: "Out of stock at the warehouse", restockedAt: NOW });
    }
  });

  it("needs a reason from the shop and the admin", () => {
    expect(errorOf(() => plan("placed", "cancel", "shop_owner", {})).fields).toHaveProperty("reason");
    expect(errorOf(() => plan("placed", "cancel", "admin", { reason: "ab" })).status).toBe(422);
    expect(plan("confirmed", "cancel", "admin", { reason: "Fraud check" }).patch.cancelledBy).toBe("admin");
  });

  it("lets the customer cancel only before the shop confirms (reason optional)", () => {
    const c = plan("placed", "cancel", "customer");
    expect(c.patch).toMatchObject({ cancelledBy: "customer", cancelReason: "Cancelled by the customer" });
    expect(c.restock).toBe(true);
    expect(plan("placed", "cancel", "customer", { reason: "Ordered twice" }).patch.cancelReason).toBe("Ordered twice");
    const err = errorOf(() => plan("confirmed", "cancel", "customer"));
    expect(err.status).toBe(403);
    expect(err.message).toMatch(/already confirmed/);
  });

  it("refuses to cancel after handover or twice", () => {
    for (const status of ["handed_over", "delivered", "refused", "returned"] as const) {
      expect(errorOf(() => plan(status, "cancel", "admin", { reason: "Too late" })).code).toBe("INVALID_TRANSITION");
    }
    expect(errorOf(() => plan("handed_over", "cancel", "shop_staff", { reason: "x x x" })).message).toMatch(/handed over/);
    expect(errorOf(() => plan("cancelled", "cancel", "customer")).message).toMatch(/already cancelled/);
  });
});

describe("who may do what", () => {
  it("keeps customers and jobs away from the shop's steps", () => {
    for (const action of ["confirm", "pack", "hand_over"] as const) {
      expect(actorAllowed(action, "placed", "customer", TEST)).toBe(false);
      expect(actorAllowed(action, "placed", "system", TEST)).toBe(false);
      expect(actorAllowed(action, "placed", "shop_staff", TEST)).toBe(true);
      expect(actorAllowed(action, "placed", "admin", PROD)).toBe(true);
    }
  });

  it("final statuses allow nothing for anyone except closing as returned", () => {
    for (const role of ROLES) {
      expect(availableActions("cancelled", role, TEST)).toEqual([]);
      expect(availableActions("returned", role, TEST)).toEqual([]);
    }
    expect(availableActions("refused", "shop_staff", TEST)).toEqual(["mark_returned"]);
    expect(availableActions("delivered", "shop_owner", TEST)).toEqual([]);
    expect(availableActions("delivered", "admin", TEST)).toEqual(["mark_returned"]);
  });

  it("lists the buttons per status and role", () => {
    expect(availableActions("placed", "shop_staff", TEST)).toEqual(["confirm", "cancel"]);
    expect(availableActions("placed", "customer", TEST)).toEqual(["cancel"]);
    expect(availableActions("confirmed", "customer", TEST)).toEqual([]);
    expect(availableActions("packed", "shop_owner", TEST)).toEqual(["hand_over", "cancel"]);
    expect(availableActions("handed_over", "shop_staff", TEST)).toEqual(["deliver", "refuse"]);
    expect(availableActions("handed_over", "shop_staff", PROD)).toEqual([]);
    expect(availableActions("handed_over", "admin", PROD)).toEqual(["deliver", "refuse"]);
  });

  it("every planned transition matches availableActions (no hidden paths)", () => {
    for (const status of STATUSES) {
      for (const role of ROLES) {
        const allowed = availableActions(status, role, TEST);
        for (const action of LIFECYCLE_ACTIONS) {
          const input = { reason: "A valid reason", courierName: "RedX", trackingNo: "RX-1" };
          let ok = true;
          try {
            plan(status, action, role, input);
          } catch {
            ok = false;
          }
          expect(ok, `${role} ${action} on ${status}`).toBe(allowed.includes(action));
        }
      }
    }
  });
});

describe("parsing and config", () => {
  it("parses known actions only", () => {
    expect(parseAction("hand_over")).toBe("hand_over");
    expect(errorOf(() => parseAction("ship")).status).toBe(422);
    expect(errorOf(() => parseAction(undefined)).fields).toHaveProperty("action");
  });

  it("lets shops mark delivery in test mode by default, and follows SHOP_MARKS_DELIVERY", () => {
    expect(loadLifecycleConfig({ APP_MODE: "test" }).shopMarksDelivery).toBe(true);
    expect(loadLifecycleConfig({ APP_MODE: "production" }).shopMarksDelivery).toBe(false);
    expect(loadLifecycleConfig({ APP_MODE: "production", SHOP_MARKS_DELIVERY: "true" }).shopMarksDelivery).toBe(true);
    expect(loadLifecycleConfig({ APP_MODE: "test", SHOP_MARKS_DELIVERY: "false" }).shopMarksDelivery).toBe(false);
  });
});

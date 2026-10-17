import { describe, expect, it } from "vitest";
import { createFakeDb } from "@/lib/testing/fake-db";
import { linkGuestOrders, type LinkingDeps } from "./linking";

// US-009: guest orders join an account only through a VERIFIED mobile or email.

const NOW = new Date("2026-10-17T06:00:00Z");

function setup(user: { phone?: string | null; phoneVerifiedAt?: Date | null; email?: string | null; emailVerifiedAt?: Date | null; status?: string }) {
  const db = createFakeDb({
    order: [
      { id: "g-phone", userId: null, contactPhone: "+8801812345678", contactEmail: "other@ecom.test" },
      { id: "g-email", userId: null, contactPhone: "+8801999999999", contactEmail: "karim@ecom.test" },
      { id: "g-other", userId: null, contactPhone: "+8801555555555", contactEmail: "x@ecom.test" },
      { id: "taken", userId: "u-other", contactPhone: "+8801812345678", contactEmail: "karim@ecom.test" },
    ],
  });
  const deps: LinkingDeps = {
    findUser: async () => ({ id: "u-1", phone: null, phoneVerifiedAt: null, email: null, emailVerifiedAt: null, status: "active", ...user }),
    attach: async (userId, by, via, at) => (await db.order.updateMany({ where: { userId: null, ...by }, data: { userId, linkedVia: via, linkedAt: at } })).count,
    now: () => NOW,
  };
  const owner = (id: string) => db.order.rows.find((r) => r.id === id)!.userId;
  return { deps, owner, db };
}

describe("linkGuestOrders", () => {
  it("attaches guest orders of the verified mobile at sign-up or login", async () => {
    const { deps, owner } = setup({ phone: "+8801812345678", phoneVerifiedAt: NOW });
    expect(await linkGuestOrders("u-1", deps)).toEqual({ byPhone: 1, byEmail: 0 });
    expect(owner("g-phone")).toBe("u-1");
    expect(owner("g-email")).toBeNull();
    expect(owner("taken")).toBe("u-other"); // an account's order never moves
  });

  it("attaches nothing through an unverified mobile or email", async () => {
    const { deps, owner } = setup({ phone: "+8801812345678", email: "karim@ecom.test" });
    expect(await linkGuestOrders("u-1", deps)).toEqual({ byPhone: 0, byEmail: 0 });
    expect(owner("g-phone")).toBeNull();
    expect(owner("g-email")).toBeNull();
  });

  it("attaches guest orders of the email once the account owner verifies that email", async () => {
    const { deps, owner, db } = setup({ email: "karim@ecom.test", emailVerifiedAt: NOW });
    expect(await linkGuestOrders("u-1", deps)).toEqual({ byPhone: 0, byEmail: 1 });
    expect(owner("g-email")).toBe("u-1");
    expect(db.order.rows.find((r) => r.id === "g-email")).toMatchObject({ linkedVia: "email", linkedAt: NOW });
    expect(owner("g-other")).toBeNull();
  });

  it("does nothing for a suspended or missing account", async () => {
    const { deps, owner } = setup({ phone: "+8801812345678", phoneVerifiedAt: NOW, status: "suspended" });
    expect(await linkGuestOrders("u-1", deps)).toEqual({ byPhone: 0, byEmail: 0 });
    expect(owner("g-phone")).toBeNull();
    expect(await linkGuestOrders("u-x", { ...deps, findUser: async () => null })).toEqual({ byPhone: 0, byEmail: 0 });
  });
});

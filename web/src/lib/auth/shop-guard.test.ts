import { describe, expect, it } from "vitest";
import type { ShopRole } from "@/generated/prisma/client";
import { ForbiddenError, UnauthorizedError } from "./errors";
import type { GuardUser } from "./guards-core";
import { createShopGuard } from "./shop-guard-core";

const user = (id: string): GuardUser => ({
  id,
  email: `${id}@ecom.test`,
  phone: null,
  name: id,
  isPlatformAdmin: false,
  status: "active",
});

// shop A: ownerA (owner), staffA (staff). shop B: ownerB (owner).
const memberships: Record<string, ShopRole> = { "A:ownerA": "owner", "A:staffA": "staff", "B:ownerB": "owner" };

function guardFor(userId: string | null) {
  return createShopGuard({
    requireUser: async () => {
      if (!userId) throw new UnauthorizedError();
      return user(userId);
    },
    findShopRole: async (shopId, uid) => memberships[`${shopId}:${uid}`] ?? null,
  });
}

describe("requireShopRole", () => {
  it("allows the owner of the shop", async () => {
    await expect(guardFor("ownerA")("A", ["owner"])).resolves.toMatchObject({ shopId: "A", role: "owner" });
  });

  it("allows staff where staff is allowed", async () => {
    await expect(guardFor("staffA")("A", ["owner", "staff"])).resolves.toMatchObject({ shopId: "A", role: "staff" });
  });

  it("denies staff an owner-only action (403)", async () => {
    await expect(guardFor("staffA")("A", ["owner"])).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("denies staff of shop A access to shop B (403)", async () => {
    await expect(guardFor("staffA")("B", ["owner", "staff"])).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("denies the owner of shop A access to shop B (403)", async () => {
    await expect(guardFor("ownerA")("B", ["owner"])).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("gives the same 403 for a shop that does not exist or an empty id", async () => {
    await expect(guardFor("ownerA")("nope", ["owner"])).rejects.toBeInstanceOf(ForbiddenError);
    await expect(guardFor("ownerA")("", ["owner"])).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws 401 for a guest", async () => {
    await expect(guardFor(null)("A", ["owner"])).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

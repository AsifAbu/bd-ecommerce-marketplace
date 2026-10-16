import { describe, expect, it } from "vitest";
import { createGuards, type GuardUser } from "./guards-core";
import { ForbiddenError, UnauthorizedError } from "./errors";

const base: GuardUser = {
  id: "u1",
  email: "c@ecom.test",
  emailVerifiedAt: new Date(),
  phone: null,
  name: "Customer",
  isPlatformAdmin: false,
  status: "active",
};

function guardsFor(sessionUserId: string | null, user: GuardUser | null) {
  return createGuards({
    getSessionUserId: async () => sessionUserId,
    findUserById: async (id) => (user && user.id === id ? user : null),
  });
}

describe("requireUser", () => {
  it("returns the active logged-in user", async () => {
    await expect(guardsFor("u1", base).requireUser()).resolves.toEqual(base);
  });

  it("throws 401 for a guest", async () => {
    await expect(guardsFor(null, base).requireUser()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws 401 when the session user no longer exists", async () => {
    await expect(guardsFor("gone", base).requireUser()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws 401 for a suspended user", async () => {
    await expect(guardsFor("u1", { ...base, status: "suspended" }).requireUser()).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});

describe("requirePlatformAdmin", () => {
  it("returns a Platform Admin", async () => {
    const admin = { ...base, isPlatformAdmin: true };
    await expect(guardsFor("u1", admin).requirePlatformAdmin()).resolves.toEqual(admin);
  });

  it("throws 403 for a customer", async () => {
    const err = await guardsFor("u1", base).requirePlatformAdmin().catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(err.status).toBe(403);
  });

  it("throws 401 (not 403) for a guest", async () => {
    await expect(guardsFor(null, null).requirePlatformAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws 401 for a suspended admin", async () => {
    const admin = { ...base, isPlatformAdmin: true, status: "suspended" as const };
    await expect(guardsFor("u1", admin).requirePlatformAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

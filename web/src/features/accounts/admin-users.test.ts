import { describe, expect, it } from "vitest";
import { createGuards, type GuardUser } from "@/lib/auth/guards-core";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";
import { createAdminUsers, type AdminUsersDeps } from "./admin-users";
import { errorResponse } from "./http";

const admin: GuardUser = { id: "admin", email: "a@ecom.test", emailVerifiedAt: new Date(), phone: null, name: "A", isPlatformAdmin: true, status: "active" };
const customer: GuardUser = { ...admin, id: "cust", isPlatformAdmin: false };

function setup(sessionUser: GuardUser | null) {
  const audits: unknown[] = [];
  const changes: unknown[] = [];
  const { requirePlatformAdmin } = createGuards({
    getSessionUserId: async () => sessionUser?.id,
    findUserById: async (id) => [admin, customer].find((u) => u.id === id) ?? null,
  });
  const deps: AdminUsersDeps = {
    requirePlatformAdmin,
    searchUsers: async () => [],
    updateUserWithAudit: async (userId, change, audit) => {
      if (userId === "missing") return false;
      changes.push({ userId, change });
      audits.push(audit);
      return true;
    },
  };
  return { svc: createAdminUsers(deps), audits, changes };
}

describe("admin user management access", () => {
  it("returns 403 for a customer on every operation", async () => {
    const { svc, changes } = setup(customer);
    for (const call of [() => svc.list(""), () => svc.apply("x", "suspend"), () => svc.apply("x", "grantAdmin")]) {
      const err = await call().catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(errorResponse(err).status).toBe(403);
    }
    expect(changes).toHaveLength(0);
  });

  it("returns 401 for a guest", async () => {
    const { svc } = setup(null);
    const err = await svc.list("").catch((e) => e);
    expect(err).toBeInstanceOf(UnauthorizedError);
    const res = errorResponse(err);
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: { code: "UNAUTHORIZED", message: "Login required" } });
  });

  it("lets a Platform Admin list users", async () => {
    const { svc } = setup(admin);
    await expect(svc.list("rahim")).resolves.toEqual([]);
  });
});

describe("admin user changes are audited", () => {
  it.each([
    ["suspend", { status: "suspended" }, "user.suspended"],
    ["reactivate", { status: "active" }, "user.reactivated"],
    ["grantAdmin", { isPlatformAdmin: true }, "user.admin_granted"],
    ["revokeAdmin", { isPlatformAdmin: false }, "user.admin_revoked"],
  ] as const)("%s writes the change and an audit entry", async (action, change, auditAction) => {
    const { svc, audits, changes } = setup(admin);
    await expect(svc.apply("cust", action)).resolves.toBe(true);
    expect(changes).toEqual([{ userId: "cust", change }]);
    expect(audits).toEqual([{ actorId: "admin", action: auditAction, data: change }]);
  });

  it("does not let an admin suspend or demote themselves", async () => {
    const { svc, audits } = setup(admin);
    await expect(svc.apply("admin", "revokeAdmin")).rejects.toBeInstanceOf(ForbiddenError);
    expect(audits).toHaveLength(0);
  });

  it("reports a missing user", async () => {
    const { svc } = setup(admin);
    await expect(svc.apply("missing", "suspend")).resolves.toBe(false);
  });
});

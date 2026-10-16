import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShopRole } from "@/generated/prisma/client";

/*
 * Server actions: authorisation (admin-only review, owner-only shop changes, no cross-shop
 * access) and the approval rules wired end to end. Next, storage, mail and the repo are mocked;
 * the real guards run against an in-memory user/membership table.
 */

const h = vi.hoisted(() => ({
  sessionUserId: null as string | null,
  users: {
    admin: { isPlatformAdmin: true },
    ownerA: { isPlatformAdmin: false },
    staffA: { isPlatformAdmin: false },
    ownerB: { isPlatformAdmin: false },
    customer: { isPlatformAdmin: false },
  } as Record<string, { isPlatformAdmin: boolean }>,
  roles: { "A:ownerA": "owner", "A:staffA": "staff", "B:ownerB": "owner" } as Record<string, string>,
}));

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
}));
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({ putObject: vi.fn(async () => {}), getSignedUrl: vi.fn() }),
}));
vi.mock("@/lib/mail", () => ({ sendMail: vi.fn(async () => {}) }));
vi.mock("./repo", () => ({
  getShop: vi.fn(),
  listLicences: vi.fn(async () => []),
  updateProfile: vi.fn(),
  requestUpgrade: vi.fn(),
  addLicence: vi.fn(),
  createInvite: vi.fn(),
  removeStaff: vi.fn(async () => true),
  isSlugTaken: vi.fn(async () => false),
  createShopApplication: vi.fn(async () => ({ id: "new-shop" })),
  findInviteByTokenHash: vi.fn(),
  acceptInvite: vi.fn(),
  adminGetShop: vi.fn(),
  adminGetLicence: vi.fn(),
  adminUpdateShop: vi.fn(),
  adminReviewLicence: vi.fn(),
}));
vi.mock("@/lib/auth", async () => {
  const errors = await import("@/lib/auth/errors");
  const { createGuards } = await import("@/lib/auth/guards-core");
  const { createShopGuard } = await import("@/lib/auth/shop-guard-core");
  const guards = createGuards({
    getSessionUserId: async () => h.sessionUserId,
    findUserById: async (id) =>
      h.users[id]
        ? { id, email: `${id}@ecom.test`, phone: null, name: id, status: "active", ...h.users[id] }
        : null,
  });
  const requireShopRole = createShopGuard({
    requireUser: guards.requireUser,
    findShopRole: async (shopId, userId) => (h.roles[`${shopId}:${userId}`] as ShopRole) ?? null,
  });
  return { ...errors, ...guards, requireShopRole };
});

const actions = await import("./actions");
const repo = vi.mocked(await import("./repo"));

const form = (fields: Record<string, string | File>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};
const as = (userId: string | null) => {
  h.sessionUserId = userId;
};
const pdf = () => new File(["%PDF"], "doc.pdf", { type: "application/pdf" });
const shopRow = (over: Record<string, unknown> = {}) =>
  ({ id: "A", name: "Shop A", status: "pending", type: "general", tier: "basic", upgradeStatus: "none", licences: [], ...over }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  repo.getShop.mockResolvedValue(shopRow());
  repo.adminGetShop.mockResolvedValue(shopRow());
});

describe("admin-only actions", () => {
  const adminActions = [
    ["approveShop", actions.approveShop, { shopId: "A" }],
    ["rejectShop", actions.rejectShop, { shopId: "A", reason: "Fake documents" }],
    ["suspendShop", actions.suspendShop, { shopId: "A", reason: "Complaints" }],
    ["approveUpgrade", actions.approveUpgrade, { shopId: "A" }],
    ["rejectUpgrade", actions.rejectUpgrade, { shopId: "A", reason: "Unreadable" }],
    ["verifyLicence", actions.verifyLicence, { licenceId: "L" }],
    ["rejectLicence", actions.rejectLicence, { licenceId: "L", reason: "Expired" }],
  ] as const;

  it.each(adminActions)("%s: shop owner gets 403 and nothing changes", async (_n, action, fields) => {
    as("ownerA");
    const result = await action(undefined, form(fields));
    expect(result).toEqual({ error: { code: "FORBIDDEN", message: "Platform Admin only" } });
    expect(repo.adminUpdateShop).not.toHaveBeenCalled();
    expect(repo.adminReviewLicence).not.toHaveBeenCalled();
  });

  it.each(adminActions)("%s: guest gets 401", async (_n, action, fields) => {
    as(null);
    expect(await action(undefined, form(fields))).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("admin approves a pending shop, with an audit action", async () => {
    as("admin");
    expect(await actions.approveShop(undefined, form({ shopId: "A" }))).toEqual({ ok: true, message: "Shop A approved" });
    expect(repo.adminUpdateShop).toHaveBeenCalledWith("A", { status: "approved", statusReason: null }, "admin", "shop.approved", {
      from: "pending",
    });
  });

  it("admin can't approve a medicine shop before the licence is verified", async () => {
    as("admin");
    repo.adminGetShop.mockResolvedValue(
      shopRow({ type: "medicine", licences: [{ status: "pending", expiryDate: new Date("2099-01-01") }] }),
    );
    const result = await actions.approveShop(undefined, form({ shopId: "A" }));
    expect(result).toMatchObject({ error: { code: "CONFLICT", message: expect.stringMatching(/Verify the medicine licence/) } });
    expect(repo.adminUpdateShop).not.toHaveBeenCalled();
  });

  it("admin approves a medicine shop after the licence is verified", async () => {
    as("admin");
    repo.adminGetShop.mockResolvedValue(
      shopRow({ type: "medicine", licences: [{ status: "verified", expiryDate: new Date("2099-01-01") }] }),
    );
    expect(await actions.approveShop(undefined, form({ shopId: "A" }))).toMatchObject({ ok: true });
  });

  it("reject needs a reason", async () => {
    as("admin");
    expect(await actions.rejectShop(undefined, form({ shopId: "A", reason: "" }))).toMatchObject({
      error: { code: "VALIDATION", fields: { reason: expect.any(String) } },
    });
  });

  it("admin approves a pending Verified upgrade", async () => {
    as("admin");
    repo.adminGetShop.mockResolvedValue(shopRow({ upgradeStatus: "pending" }));
    await actions.approveUpgrade(undefined, form({ shopId: "A" }));
    expect(repo.adminUpdateShop).toHaveBeenCalledWith(
      "A",
      { tier: "verified", upgradeStatus: "approved", upgradeReason: null },
      "admin",
      "shop.upgrade_approved",
    );
  });

  it("admin verifies a pending licence", async () => {
    as("admin");
    repo.adminGetLicence.mockResolvedValue({ id: "L", shopId: "A", licenceNo: "DGDA-1", status: "pending" } as never);
    expect(await actions.verifyLicence(undefined, form({ licenceId: "L" }))).toMatchObject({ ok: true });
    expect(repo.adminReviewLicence).toHaveBeenCalledWith(expect.objectContaining({ id: "L" }), { status: "verified" }, "admin");
  });
});

describe("shop-scoped actions: no cross-shop access", () => {
  const profile = { logoUrl: "https://a.example/logo.png" };

  it("owner of A updates A's profile, scoped to A", async () => {
    as("ownerA");
    expect(await actions.updateProfile(undefined, form({ shopId: "A", ...profile }))).toMatchObject({ ok: true });
    expect(repo.updateProfile).toHaveBeenCalledWith("A", expect.objectContaining(profile), "ownerA");
  });

  it("staff of A can't change shop B (403)", async () => {
    as("staffA");
    for (const [action, fields] of [
      [actions.updateProfile, { shopId: "B", ...profile }],
      [actions.inviteStaff, { shopId: "B", email: "x@ecom.test" }],
      [actions.removeStaff, { shopId: "B", memberId: "m1" }],
      [actions.requestUpgrade, { shopId: "B", registrationType: "tin", registrationNo: "123", registrationDoc: pdf() }],
      [actions.uploadLicence, { shopId: "B", licenceNo: "L1", licenceExpiry: "2099-01-01", licenceFile: pdf() }],
    ] as const) {
      expect(await action(undefined, form(fields))).toMatchObject({ error: { code: "FORBIDDEN" } });
    }
    expect(repo.updateProfile).not.toHaveBeenCalled();
    expect(repo.createInvite).not.toHaveBeenCalled();
    expect(repo.removeStaff).not.toHaveBeenCalled();
    expect(repo.requestUpgrade).not.toHaveBeenCalled();
    expect(repo.addLicence).not.toHaveBeenCalled();
  });

  it("owner of A can't change shop B (403)", async () => {
    as("ownerA");
    expect(await actions.updateProfile(undefined, form({ shopId: "B", ...profile }))).toMatchObject({
      error: { code: "FORBIDDEN" },
    });
  });

  it("staff can't do owner-only actions in their own shop", async () => {
    as("staffA");
    expect(await actions.updateProfile(undefined, form({ shopId: "A", ...profile }))).toMatchObject({
      error: { code: "FORBIDDEN" },
    });
    expect(await actions.inviteStaff(undefined, form({ shopId: "A", email: "x@ecom.test" }))).toMatchObject({
      error: { code: "FORBIDDEN" },
    });
  });

  it("removeStaff passes the guard-checked shopId to the repo", async () => {
    as("ownerA");
    await actions.removeStaff(undefined, form({ shopId: "A", memberId: "m-of-B" }));
    expect(repo.removeStaff).toHaveBeenCalledWith("A", "m-of-B", "ownerA");
  });
});

describe("application and upgrade", () => {
  it("a logged-in user applies and is redirected to the new shop", async () => {
    as("customer");
    const fd = form({
      name: "Dhaka Books",
      slug: "dhaka-books",
      type: "books",
      ownerNid: "1234567890",
      ownerPhoto: new File(["img"], "me.jpg", { type: "image/jpeg" }),
    });
    await expect(actions.applyForShop(undefined, fd)).rejects.toMatchObject({ url: "/seller/new-shop" });
    expect(repo.createShopApplication).toHaveBeenCalledWith(
      "customer",
      expect.objectContaining({ slug: "dhaka-books", type: "books", licence: undefined }),
    );
  });

  it("a medicine application without a licence is blocked", async () => {
    as("customer");
    const fd = form({
      name: "Dhaka Pharma",
      slug: "dhaka-pharma",
      type: "medicine",
      ownerNid: "1234567890",
      ownerPhoto: new File(["img"], "me.jpg", { type: "image/jpeg" }),
    });
    const result = await actions.applyForShop(undefined, fd);
    expect(result).toMatchObject({ error: { code: "VALIDATION", fields: { licenceNo: expect.any(String) } } });
    expect(repo.createShopApplication).not.toHaveBeenCalled();
  });

  it("a guest can't apply", async () => {
    as(null);
    expect(await actions.applyForShop(undefined, form({}))).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("owner requests the Verified upgrade", async () => {
    as("ownerA");
    const fd = form({ shopId: "A", registrationType: "trade_licence", registrationNo: "TL-1", registrationDoc: pdf() });
    expect(await actions.requestUpgrade(undefined, fd)).toMatchObject({ ok: true });
    expect(repo.requestUpgrade).toHaveBeenCalledWith(
      "A",
      expect.objectContaining({ registrationType: "trade_licence", registrationNo: "TL-1" }),
      "ownerA",
    );
  });

  it("a Verified shop can't request the upgrade again", async () => {
    as("ownerA");
    repo.getShop.mockResolvedValue(shopRow({ tier: "verified" }));
    const fd = form({ shopId: "A", registrationType: "tin", registrationNo: "TL-1", registrationDoc: pdf() });
    expect(await actions.requestUpgrade(undefined, fd)).toMatchObject({ error: { code: "CONFLICT" } });
  });
});

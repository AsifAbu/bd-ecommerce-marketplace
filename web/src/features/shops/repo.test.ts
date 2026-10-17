import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "./fake-db";

// Shop-scoped repositories (ADR-004): calls scoped to shop A never read or change shop B.
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  get prisma() {
    return state.db;
  },
}));

const repo = await import("./repo");

let db: ReturnType<typeof createFakeDb>;

beforeEach(() => {
  db = createFakeDb({
    shop: [
      { id: "A", name: "Shop A", tier: "basic", logoUrl: null },
      { id: "B", name: "Shop B", tier: "basic", logoUrl: "https://b.example/logo.png" },
    ],
    shopLicence: [
      { id: "lA", shopId: "A", licenceNo: "LIC-A" },
      { id: "lB", shopId: "B", licenceNo: "LIC-B" },
    ],
    shopMember: [
      { id: "mA-owner", shopId: "A", userId: "ownerA", role: "owner" },
      { id: "mA-staff", shopId: "A", userId: "staffA", role: "staff" },
      { id: "mB-staff", shopId: "B", userId: "staffB", role: "staff" },
    ],
    shopInvite: [
      { id: "iA", shopId: "A", email: "a@ecom.test", acceptedAt: null },
      { id: "iB", shopId: "B", email: "b@ecom.test", acceptedAt: null },
    ],
  });
  state.db = db;
});

describe("shop-scoped repo", () => {
  it("getShop returns only the scoped shop", async () => {
    expect((await repo.getShop("A"))?.id).toBe("A");
    expect(await repo.getShop("missing")).toBeNull();
  });

  it("listLicences, listMembers and listPendingInvites never return another shop's rows", async () => {
    expect((await repo.listLicences("A")).map((l) => l.id)).toEqual(["lA"]);
    expect((await repo.listMembers("A")).map((m) => m.id)).toEqual(["mA-owner", "mA-staff"]);
    expect((await repo.listPendingInvites("A")).map((i) => i.id)).toEqual(["iA"]);
  });

  it("updateProfile changes only the scoped shop", async () => {
    await repo.updateProfile("A", { logoUrl: "https://a.example/logo.png" }, "ownerA");
    expect(db.shop.rows.find((s) => s.id === "A")?.logoUrl).toBe("https://a.example/logo.png");
    expect(db.shop.rows.find((s) => s.id === "B")?.logoUrl).toBe("https://b.example/logo.png");
    expect(db.auditLog.rows).toHaveLength(1);
  });

  it("requestUpgrade changes only the scoped shop", async () => {
    await repo.requestUpgrade("A", { registrationType: "tin", registrationNo: "123", registrationDocKey: "k" }, "ownerA");
    expect(db.shop.rows.find((s) => s.id === "A")?.upgradeStatus).toBe("pending");
    expect(db.shop.rows.find((s) => s.id === "B")?.upgradeStatus).toBeUndefined();
  });

  it("addLicence and createInvite always write the scoped shopId", async () => {
    await repo.addLicence("A", { licenceNo: "NEW", expiryDate: new Date(), documentKey: "k" }, "ownerA");
    await repo.createInvite("A", { email: "x@ecom.test", tokenHash: "h", expiresAt: new Date() }, "ownerA");
    expect(db.shopLicence.rows.find((l) => l.licenceNo === "NEW")?.shopId).toBe("A");
    expect(db.shopInvite.rows.find((i) => i.email === "x@ecom.test")?.shopId).toBe("A");
  });

  it("removeStaff cannot remove another shop's member", async () => {
    expect(await repo.removeStaff("A", "mB-staff", "ownerA")).toBe(false);
    expect(db.shopMember.rows.some((m) => m.id === "mB-staff")).toBe(true);
  });

  it("removeStaff cannot remove the owner", async () => {
    expect(await repo.removeStaff("A", "mA-owner", "ownerA")).toBe(false);
  });

  it("removeStaff removes the scoped shop's staff member", async () => {
    expect(await repo.removeStaff("A", "mA-staff", "ownerA")).toBe(true);
    expect(db.shopMember.rows.map((m) => m.id)).toEqual(["mA-owner", "mB-staff"]);
  });
});

describe("acceptInvite (user-scoped)", () => {
  const invite = { id: "iA", shopId: "A", email: "a@ecom.test" };
  const addUser = (email: string | null, emailVerifiedAt: Date | null) =>
    db.user.rows.push({ id: "u1", email, emailVerifiedAt });

  it("adds a verified, matching user as staff of the invite's shop and marks the invite used", async () => {
    addUser("A@ecom.test", new Date());
    await repo.acceptInvite("u1", invite);
    expect(db.shopMember.rows).toContainEqual(expect.objectContaining({ shopId: "A", userId: "u1", role: "staff" }));
    expect(db.shopInvite.rows.find((i) => i.id === "iA")?.acceptedAt).toBeInstanceOf(Date);
    expect(db.shopInvite.rows.find((i) => i.id === "iB")?.acceptedAt).toBeNull();
  });

  it("re-checks the email inside the transaction: unverified or different emails change nothing", async () => {
    addUser("a@ecom.test", null);
    await expect(repo.acceptInvite("u1", invite)).rejects.toThrow(/Verify your email/);
    db.user.rows[0].email = "other@ecom.test";
    db.user.rows[0].emailVerifiedAt = new Date();
    await expect(repo.acceptInvite("u1", invite)).rejects.toThrow("Log in as a@ecom.test to accept this invite");
    expect(db.shopMember.rows.some((m) => m.userId === "u1")).toBe(false);
    expect(db.shopInvite.rows.find((i) => i.id === "iA")?.acceptedAt).toBeNull();
  });

  it("getAccountEmail reads only the given user", async () => {
    addUser("a@ecom.test", null);
    expect(await repo.getAccountEmail("u1")).toMatchObject({ email: "a@ecom.test" });
    expect(await repo.getAccountEmail("u2")).toBeNull();
  });
});

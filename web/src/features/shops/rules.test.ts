import { describe, expect, it } from "vitest";
import {
  assertCanApproveShop,
  assertCanRejectShop,
  assertCanRequestUpgrade,
  assertCanReviewLicence,
  assertCanReviewUpgrade,
  assertCanSuspendShop,
  assertCanUploadLicence,
  classifyLicences,
  dhakaToday,
  ShopRuleError,
} from "./rules";

const now = new Date("2026-10-16T06:00:00Z");
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const shop = (over: Partial<Parameters<typeof assertCanApproveShop>[0]> = {}) => ({
  status: "pending" as const,
  type: "general" as const,
  tier: "basic" as const,
  upgradeStatus: "none" as const,
  ...over,
});

describe("dhakaToday", () => {
  it("uses Bangladesh time (UTC+6)", () => {
    expect(dhakaToday(new Date("2026-10-16T17:59:00Z"))).toEqual(d("2026-10-16"));
    expect(dhakaToday(new Date("2026-10-16T18:00:00Z"))).toEqual(d("2026-10-17"));
  });
});

describe("shop approval", () => {
  it("approves a pending general shop", () => {
    expect(() => assertCanApproveShop(shop(), [], now)).not.toThrow();
  });

  it("can't approve a medicine shop before its licence is verified", () => {
    const m = shop({ type: "medicine" });
    expect(() => assertCanApproveShop(m, [], now)).toThrow(ShopRuleError);
    expect(() => assertCanApproveShop(m, [{ status: "pending", expiryDate: d("2027-01-01") }], now)).toThrow(
      /Verify the medicine licence/,
    );
    expect(() => assertCanApproveShop(m, [{ status: "rejected", expiryDate: d("2027-01-01") }], now)).toThrow();
  });

  it("can't approve a medicine shop whose verified licence has lapsed", () => {
    const m = shop({ type: "medicine" });
    expect(() => assertCanApproveShop(m, [{ status: "verified", expiryDate: d("2026-10-15") }], now)).toThrow();
  });

  it("approves a medicine shop once the licence is verified (valid through its expiry day)", () => {
    const m = shop({ type: "medicine" });
    expect(() => assertCanApproveShop(m, [{ status: "verified", expiryDate: d("2026-10-16") }], now)).not.toThrow();
  });

  it("reinstates a suspended shop but not an approved or rejected one", () => {
    expect(() => assertCanApproveShop(shop({ status: "suspended" }), [], now)).not.toThrow();
    expect(() => assertCanApproveShop(shop({ status: "approved" }), [], now)).toThrow();
    expect(() => assertCanApproveShop(shop({ status: "rejected" }), [], now)).toThrow();
  });

  it("rejects only pending shops and suspends only approved ones", () => {
    expect(() => assertCanRejectShop(shop())).not.toThrow();
    expect(() => assertCanRejectShop(shop({ status: "approved" }))).toThrow();
    expect(() => assertCanSuspendShop(shop({ status: "approved" }))).not.toThrow();
    expect(() => assertCanSuspendShop(shop())).toThrow();
  });
});

describe("tier upgrade", () => {
  it("a Basic shop can request an upgrade", () => {
    expect(() => assertCanRequestUpgrade(shop())).not.toThrow();
    expect(() => assertCanRequestUpgrade(shop({ upgradeStatus: "rejected" }))).not.toThrow();
  });

  it("can't request twice, when already Verified, or for a rejected shop", () => {
    expect(() => assertCanRequestUpgrade(shop({ upgradeStatus: "pending" }))).toThrow(/already waiting/);
    expect(() => assertCanRequestUpgrade(shop({ tier: "verified" }))).toThrow(/already Verified/);
    expect(() => assertCanRequestUpgrade(shop({ status: "rejected" }))).toThrow();
  });

  it("admin reviews only a pending upgrade", () => {
    expect(() => assertCanReviewUpgrade(shop({ upgradeStatus: "pending" }))).not.toThrow();
    expect(() => assertCanReviewUpgrade(shop())).toThrow();
  });
});

describe("licence upload and review", () => {
  it("only medicine shops upload, and not while one is pending", () => {
    expect(() => assertCanUploadLicence(shop(), [])).toThrow();
    const m = shop({ type: "medicine" });
    expect(() => assertCanUploadLicence(m, [{ status: "rejected", expiryDate: d("2027-01-01") }])).not.toThrow();
    expect(() => assertCanUploadLicence(m, [{ status: "pending", expiryDate: d("2027-01-01") }])).toThrow();
  });

  it("only pending licences can be reviewed", () => {
    expect(() => assertCanReviewLicence({ status: "pending", expiryDate: d("2027-01-01") })).not.toThrow();
    expect(() => assertCanReviewLicence({ status: "verified", expiryDate: d("2027-01-01") })).toThrow();
  });
});

describe("classifyLicences (daily expiry job)", () => {
  const lic = (id: string, shopId: string, expiry: string, over: Partial<{ status: "verified" | "pending"; warnedAt: Date }> = {}) => ({
    id,
    shopId,
    status: "verified" as const,
    expiryDate: d(expiry),
    warnedAt: null as Date | null,
    ...over,
  });

  it("expires lapsed verified licences and suspends the shop", () => {
    const r = classifyLicences([lic("1", "S", "2026-10-15")], now);
    expect(r.toExpire.map((l) => l.id)).toEqual(["1"]);
    expect(r.shopsToSuspend).toEqual(["S"]);
  });

  it("does not expire a licence on its expiry day", () => {
    expect(classifyLicences([lic("1", "S", "2026-10-16")], now).toExpire).toEqual([]);
  });

  it("warns 30 days before expiry, once", () => {
    expect(classifyLicences([lic("1", "S", "2026-11-15")], now).toWarn.map((l) => l.id)).toEqual(["1"]);
    expect(classifyLicences([lic("1", "S", "2026-11-16")], now).toWarn).toEqual([]);
    expect(classifyLicences([lic("1", "S", "2026-11-01", { warnedAt: now })], now).toWarn).toEqual([]);
  });

  it("ignores licences that are not verified", () => {
    const r = classifyLicences([lic("1", "S", "2026-01-01", { status: "pending" })], now);
    expect(r).toEqual({ toExpire: [], toWarn: [], shopsToSuspend: [] });
  });

  it("does not suspend or warn a shop that already has a renewed licence", () => {
    const r = classifyLicences([lic("old", "S", "2026-10-01"), lic("new", "S", "2027-10-01")], now);
    expect(r.toExpire.map((l) => l.id)).toEqual(["old"]);
    expect(r.shopsToSuspend).toEqual([]);
    const soon = classifyLicences([lic("old", "S", "2026-11-01"), lic("new", "S", "2027-10-01")], now);
    expect(soon.toWarn).toEqual([]);
  });
});

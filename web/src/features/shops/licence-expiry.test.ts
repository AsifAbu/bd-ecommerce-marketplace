import { describe, expect, it, vi } from "vitest";
import { runLicenceExpiryCheck, type ExpiryDeps, type ExpiryLicence } from "./licence-expiry";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const now = new Date("2026-10-16T06:00:00Z");
const lic = (id: string, shopId: string, expiry: string, email: string | null = `owner.${shopId}@ecom.test`): ExpiryLicence => ({
  id,
  shopId,
  licenceNo: `LIC-${id}`,
  status: "verified",
  expiryDate: new Date(`${expiry}T00:00:00Z`),
  warnedAt: null,
  shop: { name: `Shop ${shopId}`, owner: { email } },
});

function deps(licences: ExpiryLicence[]) {
  return {
    findVerifiedLicences: vi.fn(async () => licences),
    findAdminEmails: vi.fn(async () => ["admin@ecom.test"]),
    expireShop: vi.fn(async () => {}),
    markWarned: vi.fn(async () => {}),
    notify: vi.fn(async () => {}),
  } satisfies ExpiryDeps;
}

describe("runLicenceExpiryCheck", () => {
  it("expires a lapsed licence, suspends medicine selling and notifies owner and admin", async () => {
    const d = deps([lic("1", "P", "2026-10-10")]);
    await expect(runLicenceExpiryCheck(now, d)).resolves.toEqual({ expired: 1, suspended: 1, warned: 0 });
    expect(d.expireShop).toHaveBeenCalledWith("P", [expect.objectContaining({ id: "1" })], true);
    expect(d.notify).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["owner.P@ecom.test", "admin@ecom.test"], subject: expect.stringMatching(/expired/) }),
    );
  });

  it("warns owner and admin 30 days before expiry and records the warning", async () => {
    const d = deps([lic("2", "Q", "2026-11-10")]);
    await expect(runLicenceExpiryCheck(now, d)).resolves.toEqual({ expired: 0, suspended: 0, warned: 1 });
    expect(d.markWarned).toHaveBeenCalledWith(expect.objectContaining({ id: "2" }), now);
    expect(d.notify).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["owner.Q@ecom.test", "admin@ecom.test"], subject: expect.stringMatching(/expires soon/) }),
    );
    expect(d.expireShop).not.toHaveBeenCalled();
  });

  it("does nothing for licences far from expiry", async () => {
    const d = deps([lic("3", "R", "2027-10-10")]);
    await expect(runLicenceExpiryCheck(now, d)).resolves.toEqual({ expired: 0, suspended: 0, warned: 0 });
    expect(d.notify).not.toHaveBeenCalled();
    expect(d.findAdminEmails).not.toHaveBeenCalled();
  });

  it("still expires and suspends every shop when an email fails", async () => {
    const d = deps([lic("4", "S", "2026-10-01"), lic("5", "T", "2026-10-02")]);
    d.notify.mockRejectedValue(new Error("smtp down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(runLicenceExpiryCheck(now, d)).resolves.toEqual({ expired: 2, suspended: 2, warned: 0 });
    expect(d.expireShop).toHaveBeenCalledWith("S", [expect.objectContaining({ id: "4" })], true);
    expect(d.expireShop).toHaveBeenCalledWith("T", [expect.objectContaining({ id: "5" })], true);
    expect(d.notify).toHaveBeenCalledTimes(2);
  });
});

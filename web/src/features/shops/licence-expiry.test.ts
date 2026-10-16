import { describe, expect, it, vi } from "vitest";
import { hasStateFailures, runLicenceExpiryCheck, type ExpiryDeps, type ExpiryLicence } from "./licence-expiry";

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
    findVerifiedLicences: vi.fn<ExpiryDeps["findVerifiedLicences"]>(async () => licences),
    findAdminEmails: vi.fn<ExpiryDeps["findAdminEmails"]>(async () => ["admin@ecom.test"]),
    expire: vi.fn<ExpiryDeps["expire"]>(async () => {}),
    suspendMedicine: vi.fn<ExpiryDeps["suspendMedicine"]>(async () => {}),
    markWarned: vi.fn<ExpiryDeps["markWarned"]>(async () => {}),
    notify: vi.fn<ExpiryDeps["notify"]>(async () => {}),
  } satisfies ExpiryDeps;
}

describe("runLicenceExpiryCheck", () => {
  it("expires a lapsed licence, suspends medicine selling and notifies owner and admin", async () => {
    const d = deps([lic("1", "P", "2026-10-10")]);
    await expect(runLicenceExpiryCheck(now, d)).resolves.toEqual({ expired: 1, suspended: 1, warned: 0, notified: 1, failures: [] });
    expect(d.expire).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
    expect(d.suspendMedicine).toHaveBeenCalledWith("P");
    expect(d.notify).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["owner.P@ecom.test", "admin@ecom.test"], subject: expect.stringMatching(/expired/) }),
    );
  });

  it("warns owner and admin 30 days before expiry and records the warning", async () => {
    const d = deps([lic("2", "Q", "2026-11-10")]);
    await expect(runLicenceExpiryCheck(now, d)).resolves.toEqual({ expired: 0, suspended: 0, warned: 1, notified: 1, failures: [] });
    expect(d.markWarned).toHaveBeenCalledWith(expect.objectContaining({ id: "2" }), now);
    expect(d.notify).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["owner.Q@ecom.test", "admin@ecom.test"], subject: expect.stringMatching(/expires soon/) }),
    );
    expect(d.expire).not.toHaveBeenCalled();
    expect(d.suspendMedicine).not.toHaveBeenCalled();
  });

  it("does nothing for licences far from expiry", async () => {
    const d = deps([lic("3", "R", "2027-10-10")]);
    await expect(runLicenceExpiryCheck(now, d)).resolves.toEqual({ expired: 0, suspended: 0, warned: 0, notified: 0, failures: [] });
    expect(d.notify).not.toHaveBeenCalled();
    expect(d.findAdminEmails).not.toHaveBeenCalled();
  });
});

describe("runLicenceExpiryCheck failures", () => {
  const quiet = vi.fn();

  it("a failed email does not stop the other shops being suspended or notified", async () => {
    const d = deps([lic("1", "P", "2026-10-10"), lic("2", "S", "2026-10-11"), lic("3", "Q", "2026-11-10")]);
    d.notify.mockRejectedValueOnce(new Error("SMTP down"));
    const result = await runLicenceExpiryCheck(now, d, quiet);

    expect(result).toEqual({
      expired: 2,
      suspended: 2,
      warned: 1,
      notified: 2,
      failures: [{ step: "notify", id: "1", error: "SMTP down" }],
    });
    expect(d.suspendMedicine.mock.calls).toEqual([["P"], ["S"]]);
    expect(d.expire).toHaveBeenCalledTimes(2);
    expect(d.markWarned).toHaveBeenCalledTimes(1);
    expect(d.notify).toHaveBeenCalledTimes(3);
    expect(quiet).toHaveBeenCalledWith(expect.stringMatching(/notify failed for 1/), expect.any(Error));
    expect(hasStateFailures(result)).toBe(false);
  });

  it("saves every state change before sending any email", async () => {
    const order: string[] = [];
    const d = deps([lic("1", "P", "2026-10-10"), lic("3", "Q", "2026-11-10")]);
    d.suspendMedicine.mockImplementation(async () => void order.push("suspend"));
    d.expire.mockImplementation(async () => void order.push("expire"));
    d.markWarned.mockImplementation(async () => void order.push("warn"));
    d.notify.mockImplementation(async () => void order.push("notify"));
    await runLicenceExpiryCheck(now, d, quiet);
    expect(order).toEqual(["suspend", "expire", "warn", "notify", "notify"]);
  });

  it("still suspends shops when the admin list can't be read; emails go to owners only", async () => {
    const d = deps([lic("1", "P", "2026-10-10")]);
    d.findAdminEmails.mockRejectedValueOnce(new Error("db timeout"));
    const result = await runLicenceExpiryCheck(now, d, quiet);
    expect(d.suspendMedicine).toHaveBeenCalledWith("P");
    expect(d.notify).toHaveBeenCalledWith(expect.objectContaining({ to: ["owner.P@ecom.test"] }));
    expect(result.failures).toEqual([{ step: "admins", id: "", error: "db timeout" }]);
  });

  it("a failed suspension keeps that shop's licence verified (retried next run) and sends no email for it", async () => {
    const d = deps([lic("1", "P", "2026-10-10"), lic("2", "S", "2026-10-11")]);
    d.suspendMedicine.mockImplementation(async (shopId: string) => {
      if (shopId === "P") throw new Error("deadlock");
    });
    const result = await runLicenceExpiryCheck(now, d, quiet);
    expect(d.expire.mock.calls.map(([l]) => l.id)).toEqual(["2"]);
    expect(d.notify).toHaveBeenCalledTimes(1);
    expect(d.notify).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.stringMatching(/Shop S/) }));
    expect(result).toMatchObject({ expired: 1, suspended: 1, failures: [{ step: "suspend", id: "P", error: "deadlock" }] });
    expect(hasStateFailures(result)).toBe(true);
  });

  it("a failed warning mark sends no email (the next run warns again)", async () => {
    const d = deps([lic("3", "Q", "2026-11-10")]);
    d.markWarned.mockRejectedValueOnce(new Error("conflict"));
    const result = await runLicenceExpiryCheck(now, d, quiet);
    expect(d.notify).not.toHaveBeenCalled();
    expect(result).toMatchObject({ warned: 0, failures: [{ step: "warn", id: "3" }] });
  });
});

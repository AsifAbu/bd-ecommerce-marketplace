import { describe, expect, it } from "vitest";
import { createFakePolicyRepo, policyVersion } from "./fake-repo";
import { createPolicyService } from "./service";

const at = (iso: string) => new Date(iso);

function setup(start = "2026-10-16T12:00:00Z") {
  let now = at(start);
  const fake = createFakePolicyRepo([
    policyVersion({ id: "terms1", slug: "terms", version: 1 }),
    policyVersion({ id: "privacy1", slug: "privacy", version: 1 }),
    policyVersion({ id: "returns1", slug: "returns", version: 1 }),
    policyVersion({ id: "delivery1", slug: "delivery", version: 1 }),
  ]);
  const service = createPolicyService(fake.repo, () => now);
  return { ...fake, service, setNow: (iso: string) => (now = at(iso)) };
}

describe("drafting and publishing", () => {
  it("drafts the next version from the latest text, publishes it, and it supersedes the old one", async () => {
    const { service, auditLog } = setup();
    const draft = await service.createDraft("admin", "terms");
    expect(draft).toMatchObject({ version: 2, status: "draft", body: "Text of terms v1" });

    await service.updateDraft("admin", draft.id, { title: "Terms v2", body: "New terms text", changeSummary: "Rewrote" });
    const published = await service.publish("admin", draft.id, null);
    expect(published).toMatchObject({ version: 2, status: "published", publishedById: "admin" });

    expect((await service.getCurrentPolicy("terms"))?.body).toBe("New terms text");
    const history = await service.history("terms");
    expect(history.map((v) => [v.version, v.state])).toEqual([
      [2, "current"],
      [1, "superseded"],
    ]);
    expect(auditLog.map((a) => a.action)).toEqual(["policy.draft_created", "policy.published"]);
  });

  it("keeps published versions immutable: no edits, no re-publish", async () => {
    const { service, versions } = setup();
    await expect(service.updateDraft("admin", "terms1", { title: "x", body: "changed", changeSummary: null })).rejects.toMatchObject({
      status: 409,
      code: "POLICY_PUBLISHED",
    });
    await expect(service.publish("admin", "terms1", null)).rejects.toMatchObject({ status: 409 });
    expect(versions.find((v) => v.id === "terms1")?.body).toBe("Text of terms v1");
  });

  it("refuses a second draft while one is open", async () => {
    const { service } = setup();
    await service.createDraft("admin", "terms");
    await expect(service.createDraft("admin", "terms")).rejects.toMatchObject({ code: "DRAFT_EXISTS" });
  });

  it("starts an unpublished policy from an empty body with the default title", async () => {
    const { service } = setup();
    await expect(service.createDraft("admin", "cookies")).resolves.toMatchObject({ version: 1, title: "Cookie Policy", body: "" });
  });

  it("rejects an unknown policy with 404", async () => {
    const { service } = setup();
    await expect(service.createDraft("admin", "nope")).rejects.toMatchObject({ status: 404 });
  });

  it("keeps a future-dated version scheduled until its effective date", async () => {
    const { service, setNow } = setup();
    const draft = await service.createDraft("admin", "returns");
    await service.publish("admin", draft.id, at("2026-11-01T00:00:00Z"));
    expect((await service.getCurrentPolicy("returns"))?.version).toBe(1);
    expect(await service.getPublishedVersion("returns", 2)).toBeNull(); // not public before it takes effect
    setNow("2026-11-01T00:00:00Z");
    expect((await service.getCurrentPolicy("returns"))?.version).toBe(2);
    expect((await service.getPublishedVersion("returns", 1))?.version).toBe(1); // old text stays viewable
  });

  it("lists every policy for the admin, including unpublished ones", async () => {
    const { service } = setup();
    const overview = await service.adminOverview();
    expect(overview.map((o) => [o.slug, o.current?.version ?? null])).toEqual([
      ["terms", 1],
      ["privacy", 1],
      ["returns", 1],
      ["delivery", 1],
      ["seller", null],
      ["cookies", null],
    ]);
  });
});

describe("acceptance", () => {
  it("records the current versions with evidence, and then counts them as accepted", async () => {
    const { service, acceptances } = setup();
    expect(await service.hasAcceptedCurrent("u1", ["returns", "delivery"])).toBe(false);
    const accepted = await service.recordAcceptance({
      userId: "u1",
      slugs: ["returns", "delivery"],
      context: "checkout",
      ip: "203.0.113.5",
      userAgent: "Vitest",
    });
    expect(accepted.map((p) => [p.slug, p.version])).toEqual([
      ["returns", 1],
      ["delivery", 1],
    ]);
    expect(acceptances[0]).toMatchObject({ userId: "u1", guestPhone: null, policyId: "returns1", context: "checkout", ip: "203.0.113.5" });
    expect(await service.hasAcceptedCurrent("u1", ["returns", "delivery"])).toBe(true);
    expect(await service.hasAcceptedCurrent("u2", ["returns", "delivery"])).toBe(false); // per user
  });

  it("asks again after a new version is published", async () => {
    const { service } = setup();
    await service.recordAcceptance({ userId: "u1", slugs: ["terms", "privacy"], context: "signup" });
    const draft = await service.createDraft("admin", "terms");
    await service.publish("admin", draft.id, null);
    const status = await service.checkAcceptance("u1", ["terms", "privacy"]);
    expect(status).toMatchObject({ accepted: false, unpublished: [] });
    expect(status.pending.map((p) => [p.slug, p.version])).toEqual([["terms", 2]]);
  });

  it("blocks with 422 POLICY_ACCEPTANCE_REQUIRED until the current Return and Delivery policies are accepted", async () => {
    const { service } = setup();
    await service.recordAcceptance({ userId: "u1", slugs: ["returns"], context: "checkout" });
    await expect(service.assertAcceptedCurrent("u1", ["returns", "delivery"])).rejects.toMatchObject({
      status: 422,
      code: "POLICY_ACCEPTANCE_REQUIRED",
      fields: { delivery: expect.stringMatching(/version 1/) },
    });
    await service.recordAcceptance({ userId: "u1", slugs: ["delivery"], context: "checkout" });
    await expect(service.assertAcceptedCurrent("u1", ["returns", "delivery"])).resolves.toBeUndefined();
  });

  it("treats a policy with no version in force as not accepted", async () => {
    const { service } = setup();
    const status = await service.checkAcceptance("u1", ["seller"]);
    expect(status).toEqual({ accepted: false, pending: [], unpublished: ["seller"] });
    await expect(service.recordAcceptance({ userId: "u1", slugs: ["seller"], context: "account" })).rejects.toMatchObject({
      status: 409,
      code: "POLICY_UNPUBLISHED",
    });
  });

  it("rejects a stale shown version with 409 POLICY_CHANGED and records nothing", async () => {
    const { service, acceptances } = setup();
    const draft = await service.createDraft("admin", "delivery");
    await service.publish("admin", draft.id, null);
    await expect(
      service.recordAcceptance({ userId: "u1", slugs: ["returns", "delivery"], shownVersions: { returns: 1, delivery: 1 }, context: "checkout" }),
    ).rejects.toMatchObject({ status: 409, code: "POLICY_CHANGED", fields: { delivery: expect.stringMatching(/version 2/) } });
    expect(acceptances).toHaveLength(0);
  });

  it("records a guest's acceptance by mobile number, and needs a user or a guest", async () => {
    const { service, acceptances } = setup();
    await service.recordAcceptance({ guestPhone: "+8801712345678", slugs: ["returns", "delivery", "privacy"], context: "checkout" });
    expect(acceptances.map((a) => [a.userId, a.guestPhone, a.slug])).toEqual([
      [null, "+8801712345678", "returns"],
      [null, "+8801712345678", "delivery"],
      [null, "+8801712345678", "privacy"],
    ]);
    await expect(service.recordAcceptance({ slugs: ["returns"], context: "checkout" })).rejects.toMatchObject({ status: 422 });
  });

  it("counts acceptances per version in the admin history", async () => {
    const { service } = setup();
    await service.recordAcceptance({ userId: "u1", slugs: ["terms"], context: "signup" });
    await service.recordAcceptance({ userId: "u2", slugs: ["terms"], context: "signup" });
    expect((await service.history("terms"))[0].acceptances).toBe(2);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGuards, type GuardUser } from "@/lib/auth/guards-core";

/*
 * Server actions: admin-only authorisation (guest 401, customer 403) checked before any form
 * input is used, and the cookie notice dismissal. The real guards run against `sessionUser`.
 */

const h = vi.hoisted(() => ({
  sessionUser: null as import("@/lib/auth/guards-core").GuardUser | null,
  cookieSet: vi.fn(),
}));

vi.mock("@/lib/auth", async () => {
  const errors = await vi.importActual<typeof import("@/lib/auth/errors")>("@/lib/auth/errors");
  const guards = createGuards({
    getSessionUserId: async () => h.sessionUser?.id,
    findUserById: async () => h.sessionUser,
  });
  return { ...errors, ...guards };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: h.cookieSet }),
  headers: async () => new Headers({ "user-agent": "Vitest", "x-forwarded-for": "203.0.113.9" }),
}));
vi.mock("./server", () => ({
  policyService: {
    createDraft: vi.fn(async () => ({ version: 2 })),
    updateDraft: vi.fn(async () => {}),
    publish: vi.fn(async () => ({ slug: "terms", version: 2, effectiveAt: new Date("2026-10-16T06:00:00Z") })),
    recordAcceptance: vi.fn(async () => [{ slug: "terms", version: 2, title: "Terms and Conditions" }]),
  },
  requestMeta: async () => ({ ip: "203.0.113.9", userAgent: "Vitest" }),
}));

const actions = await import("./actions");
const { policyService } = await import("./server");

const customer: GuardUser = { id: "c1", email: "c@ecom.test", phone: null, name: "Customer", isPlatformAdmin: false, status: "active" };
const admin: GuardUser = { ...customer, id: "a1", isPlatformAdmin: true };

function form(data: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) for (const x of [v].flat()) fd.append(k, x);
  return fd;
}

const adminCases = [
  ["createDraftAction", actions.createDraftAction, { slug: "terms" }, policyService.createDraft],
  ["saveDraftAction", actions.saveDraftAction, { id: "pv2", title: "Terms", body: "New terms text, long enough." }, policyService.updateDraft],
  ["publishAction", actions.publishAction, { id: "pv2", effectiveAt: "" }, policyService.publish],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  h.sessionUser = null;
});

describe("policy admin actions", () => {
  it.each(adminCases)("%s: 401 for a guest, nothing changed", async (_name, action, data, call) => {
    const res = await action(null, form(data));
    expect(res?.error).toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    expect(call).not.toHaveBeenCalled();
  });

  it.each(adminCases)("%s: 403 for a customer, nothing changed", async (_name, action, data, call) => {
    h.sessionUser = customer;
    const res = await action(null, form(data));
    expect(res?.error).toMatchObject({ status: 403, code: "FORBIDDEN" });
    expect(call).not.toHaveBeenCalled();
  });

  it.each(adminCases)("%s: runs for the Platform Admin", async (name, action, data, call) => {
    h.sessionUser = admin;
    if (name === "publishAction") {
      // Publishing reloads the policy page with a confirmation.
      await expect(action(null, form(data))).rejects.toMatchObject({ url: "/admin/policies/terms?published=2" });
    } else {
      expect((await action(null, form(data)))?.ok).toBeTruthy();
    }
    expect(call).toHaveBeenCalledOnce();
    expect(vi.mocked(call).mock.calls[0][0]).toBe("a1"); // acts as the checked admin
  });

  it("validates the form (422) for the admin", async () => {
    h.sessionUser = admin;
    expect((await actions.createDraftAction(null, form({ slug: "nope" })))?.error).toMatchObject({ status: 422 });
    expect((await actions.saveDraftAction(null, form({ id: "pv2", title: "T", body: "short" })))?.error).toMatchObject({
      status: 422,
      fields: { title: expect.any(String), body: expect.any(String) },
    });
    expect((await actions.publishAction(null, form({ id: "pv2", effectiveAt: "tomorrow" })))?.error).toMatchObject({
      status: 422,
      fields: { effectiveAt: expect.any(String) },
    });
    expect(policyService.updateDraft).not.toHaveBeenCalled();
    expect(policyService.publish).not.toHaveBeenCalled();
  });

  it("publishes with the effective date read as Dhaka time", async () => {
    h.sessionUser = admin;
    await actions.publishAction(null, form({ id: "pv2", effectiveAt: "2026-11-01T00:00" })).catch(() => {});
    expect(policyService.publish).toHaveBeenCalledWith("a1", "pv2", new Date("2026-10-31T18:00:00Z"));
  });
});

describe("accepting updated policies", () => {
  it("needs a logged-in user (401)", async () => {
    const res = await actions.acceptPoliciesAction(null, form({ slug: "terms", acceptPolicies: "on" }));
    expect(res?.error).toMatchObject({ status: 401 });
    expect(policyService.recordAcceptance).not.toHaveBeenCalled();
  });

  it("needs the checkbox", async () => {
    h.sessionUser = customer;
    const res = await actions.acceptPoliciesAction(null, form({ slug: "terms" }));
    expect(res?.error).toMatchObject({ status: 422, fields: { acceptPolicies: expect.any(String) } });
  });

  it("records the acceptance with the versions shown and the request evidence", async () => {
    h.sessionUser = customer;
    const res = await actions.acceptPoliciesAction(
      null,
      form({ slug: ["terms", "bogus"], acceptPolicies: "on", "policyVersion.terms": "2" }),
    );
    expect(res?.ok).toMatch(/Terms and Conditions v2/);
    expect(policyService.recordAcceptance).toHaveBeenCalledWith({
      userId: "c1",
      slugs: ["terms"],
      context: "account",
      shownVersions: { terms: 2 },
      ip: "203.0.113.9",
      userAgent: "Vitest",
    });
  });
});

describe("cookie notice dismissal", () => {
  it("stores the Cookie Policy version for a year without needing an account", async () => {
    await actions.dismissCookieNoticeAction(form({ version: "3" }));
    expect(h.cookieSet).toHaveBeenCalledWith("cookie_notice", "3", expect.objectContaining({ maxAge: 31_536_000, path: "/" }));
  });

  it("ignores a malformed version", async () => {
    await actions.dismissCookieNoticeAction(form({ version: "<x>" }));
    expect(h.cookieSet).toHaveBeenCalledWith("cookie_notice", "0", expect.anything());
  });
});

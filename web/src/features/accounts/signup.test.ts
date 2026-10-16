import { describe, expect, it } from "vitest";
import { verifyPassword } from "@/features/auth/password";
import { signUp, TAKEN_MESSAGE, type SignUpDeps } from "./signup";

function deps(existing: { email?: string; phone?: string }[] = []) {
  const created: Parameters<SignUpDeps["createUser"]>[0][] = [];
  const d: SignUpDeps = {
    identifierTaken: async (kind, value) => existing.some((u) => u[kind] === value),
    createUser: async (data) => {
      created.push(data);
      return { id: "new-user" };
    },
  };
  return { d, created };
}

const base = { name: "Rahim", password: "Secret@123" };

describe("sign-up validation", () => {
  it("accepts an 11-digit mobile starting 01 and stores it as +880", async () => {
    const { d, created } = deps();
    const res = await signUp({ ...base, phone: "017 1234-5678", email: "" }, d);
    expect(res).toMatchObject({ ok: true, userId: "new-user" });
    expect(created[0]).toMatchObject({ phone: "+8801712345678", email: null, name: "Rahim" });
    expect(await verifyPassword("Secret@123", created[0].passwordHash)).toBe(true);
  });

  it("accepts email only, lower-cased", async () => {
    const { d, created } = deps();
    await expect(signUp({ ...base, email: " Rahim@Example.COM " }, d)).resolves.toMatchObject({ ok: true });
    expect(created[0]).toMatchObject({ email: "rahim@example.com", phone: null });
  });

  it.each(["0171234567", "017123456789", "02123456789", "01212345678", "+8801712345678", "abc"])(
    "rejects mobile %s",
    async (phone) => {
      const { d, created } = deps();
      const res = await signUp({ ...base, phone }, d);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.fields.phone).toMatch(/11-digit/);
      expect(created).toHaveLength(0);
    },
  );

  it("needs a mobile or an email, a name and an 8+ character password", async () => {
    const { d } = deps();
    const res = await signUp({ name: "", password: "short" }, d);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(Object.keys(res.fields).sort()).toEqual(["name", "password", "phone"]);
  });

  it("rejects an invalid email", async () => {
    const { d } = deps();
    const res = await signUp({ ...base, email: "not-an-email" }, d);
    expect(res).toMatchObject({ ok: false, fields: { email: expect.any(String) } });
  });
});

describe("sign-up uniqueness", () => {
  const existing = [{ email: "taken@ecom.test", phone: "+8801700000002" }];

  it("rejects a mobile that already has an account", async () => {
    const { d, created } = deps(existing);
    await expect(signUp({ ...base, phone: "01700000002" }, d)).resolves.toEqual({
      ok: false,
      fields: { phone: TAKEN_MESSAGE.phone },
    });
    expect(created).toHaveLength(0);
  });

  it("rejects an email that already has an account, in any case", async () => {
    const { d } = deps(existing);
    await expect(signUp({ ...base, email: "TAKEN@ecom.test" }, d)).resolves.toEqual({
      ok: false,
      fields: { email: TAKEN_MESSAGE.email },
    });
  });

  it("never marks identifiers verified at sign-up", async () => {
    const { d, created } = deps();
    await signUp({ ...base, phone: "01712345678", email: "a@ecom.test" }, d);
    expect(created[0]).not.toHaveProperty("phoneVerifiedAt");
    expect(created[0]).not.toHaveProperty("emailVerifiedAt");
  });
});

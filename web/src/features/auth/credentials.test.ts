import { describe, expect, it } from "vitest";
import { authorizeCredentials, type FindUserByIdentifier } from "./credentials";
import { fakeThrottleDeps } from "./fake-login-store";
import { normalizeBdPhone, parseLoginIdentifier } from "./identifier";
import { createLoginThrottle } from "./login-throttle";
import { hashPassword } from "./password";

describe("login identifiers", () => {
  it("normalises Bangladeshi mobiles to +880", () => {
    for (const input of ["01700000002", "+8801700000002", "8801700000002", "017-0000 0002"]) {
      expect(normalizeBdPhone(input)).toBe("+8801700000002");
    }
    expect(normalizeBdPhone("01200000002")).toBeNull();
    expect(normalizeBdPhone("0170000000")).toBeNull();
  });

  it("parses email or mobile", () => {
    expect(parseLoginIdentifier(" Admin@Ecom.Test ")).toEqual({ kind: "email", value: "admin@ecom.test" });
    expect(parseLoginIdentifier("01700000001")).toEqual({ kind: "phone", value: "+8801700000001" });
    expect(parseLoginIdentifier("not-an-id")).toBeNull();
  });
});

describe("authorizeCredentials", async () => {
  const passwordHash = await hashPassword("Test@12345");
  const user = {
    id: "u1",
    email: "c@ecom.test",
    phone: "+8801700000002",
    name: "C",
    passwordHash,
    status: "active" as const,
  };
  const find: FindUserByIdentifier = async (kind, value) =>
    (kind === "email" ? user.email : user.phone) === value ? user : null;

  it("logs in by email or mobile", async () => {
    await expect(authorizeCredentials({ identifier: "C@ecom.test", password: "Test@12345" }, find)).resolves.toMatchObject({ id: "u1" });
    await expect(authorizeCredentials({ identifier: "01700000002", password: "Test@12345" }, find)).resolves.toMatchObject({ id: "u1" });
  });

  it("rejects a wrong password, unknown user, bad input or suspended user", async () => {
    await expect(authorizeCredentials({ identifier: "c@ecom.test", password: "nope" }, find)).resolves.toBeNull();
    await expect(authorizeCredentials({ identifier: "x@ecom.test", password: "Test@12345" }, find)).resolves.toBeNull();
    await expect(authorizeCredentials({ identifier: 5 }, find)).resolves.toBeNull();
    const suspended: FindUserByIdentifier = async () => ({ ...user, status: "suspended" });
    await expect(authorizeCredentials({ identifier: "c@ecom.test", password: "Test@12345" }, suspended)).resolves.toBeNull();
  });

  describe("with the login lockout", () => {
    const login = (identifier: string, password: string, deps: ReturnType<typeof fakeThrottleDeps>, ip: string | null = "1.1.1.1") =>
      authorizeCredentials({ identifier, password }, find, { throttle: createLoginThrottle(deps), ip });

    it("5 wrong passwords lock the account for 15 minutes, even with the right password", async () => {
      const deps = fakeThrottleDeps();
      for (let i = 0; i < 5; i++) await expect(login("c@ecom.test", "wrong", deps)).resolves.toBeNull();
      await expect(login("c@ecom.test", "Test@12345", deps)).resolves.toBeNull();
      // The same lock whichever way the identifier is written (mobile or other case).
      await expect(login("C@Ecom.Test", "Test@12345", deps)).resolves.toBeNull();
      deps.advance(15 * 60_000);
      await expect(login("c@ecom.test", "Test@12345", deps)).resolves.toMatchObject({ id: "u1" });
    });

    it("a locked login is not recorded, so retrying does not extend the lock", async () => {
      const deps = fakeThrottleDeps();
      for (let i = 0; i < 5; i++) await login("c@ecom.test", "wrong", deps);
      await login("c@ecom.test", "wrong", deps);
      expect(deps.rows).toHaveLength(5);
    });

    it("unknown accounts are counted and locked the same way (no account probing)", async () => {
      const deps = fakeThrottleDeps();
      for (let i = 0; i < 5; i++) await login("nobody@ecom.test", "x", deps);
      expect(deps.rows.map((r) => r.identifier)).toEqual(Array(5).fill("email:nobody@ecom.test"));
      expect(deps.rows[0].ip).toBe("1.1.1.1");
    });

    it("a successful login clears earlier failures", async () => {
      const deps = fakeThrottleDeps();
      for (let i = 0; i < 4; i++) await login("01700000002", "wrong", deps);
      await expect(login("01700000002", "Test@12345", deps)).resolves.toMatchObject({ id: "u1" });
      expect(deps.rows).toEqual([]);
      for (let i = 0; i < 4; i++) await login("01700000002", "wrong", deps);
      await expect(login("01700000002", "Test@12345", deps)).resolves.toMatchObject({ id: "u1" });
    });

    it("invalid input is rejected without touching the store", async () => {
      const deps = fakeThrottleDeps();
      await expect(login("not-an-id", "x", deps)).resolves.toBeNull();
      expect(deps.rows).toEqual([]);
    });
  });
});

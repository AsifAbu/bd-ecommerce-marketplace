import { describe, expect, it } from "vitest";
import { authorizeCredentials, LOGIN_LIMITS, type FindUserByIdentifier, type LoginLimiter } from "./credentials";
import { normalizeBdPhone, parseLoginIdentifier } from "./identifier";
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

/** In-memory limiter: same rules as the Prisma one in src/auth.ts. */
function memoryLimiter() {
  let rows: { identifier: string; ip: string | null; at: Date }[] = [];
  const limiter: LoginLimiter = {
    recentFailures: async (identifier, ip, since) => ({
      byIdentifier: rows.filter((r) => r.identifier === identifier && r.at >= since).length,
      byIp: rows.filter((r) => ip && r.ip === ip && r.at >= since).length,
    }),
    recordFailure: async (identifier, ip) => void rows.push({ identifier, ip, at: new Date() }),
    clearFailures: async (identifier) => void (rows = rows.filter((r) => r.identifier !== identifier)),
  };
  return limiter;
}

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
    await expect(authorizeCredentials({ identifier: "C@ecom.test", password: "Test@12345" }, find, memoryLimiter(), null)).resolves.toMatchObject({ id: "u1" });
    await expect(authorizeCredentials({ identifier: "01700000002", password: "Test@12345" }, find, memoryLimiter(), null)).resolves.toMatchObject({ id: "u1" });
  });

  it("rejects a wrong password, unknown user, bad input or suspended user", async () => {
    await expect(authorizeCredentials({ identifier: "c@ecom.test", password: "nope" }, find, memoryLimiter(), null)).resolves.toBeNull();
    await expect(authorizeCredentials({ identifier: "x@ecom.test", password: "Test@12345" }, find, memoryLimiter(), null)).resolves.toBeNull();
    await expect(authorizeCredentials({ identifier: 5 }, find, memoryLimiter(), null)).resolves.toBeNull();
    const suspended: FindUserByIdentifier = async () => ({ ...user, status: "suspended" });
    await expect(authorizeCredentials({ identifier: "c@ecom.test", password: "Test@12345" }, suspended, memoryLimiter(), null)).resolves.toBeNull();
  });

  it("locks an identifier after 5 failures, even with the right password, then unlocks after the window", async () => {
    const limiter = memoryLimiter();
    for (let i = 0; i < LOGIN_LIMITS.perIdentifier; i++) {
      await expect(authorizeCredentials({ identifier: "c@ecom.test", password: "nope" }, find, limiter, "1.1.1.1")).resolves.toBeNull();
    }
    const good = { identifier: "c@ecom.test", password: "Test@12345" };
    await expect(authorizeCredentials(good, find, limiter, "2.2.2.2")).resolves.toBe("locked");
    const later = new Date(Date.now() + LOGIN_LIMITS.windowMs + 1000);
    await expect(authorizeCredentials(good, find, limiter, "2.2.2.2", later)).resolves.toMatchObject({ id: "u1" });
  });

  it("a successful login clears earlier failures", async () => {
    const limiter = memoryLimiter();
    for (let i = 0; i < LOGIN_LIMITS.perIdentifier - 1; i++) {
      await authorizeCredentials({ identifier: "c@ecom.test", password: "nope" }, find, limiter, null);
    }
    await authorizeCredentials({ identifier: "c@ecom.test", password: "Test@12345" }, find, limiter, null);
    await expect(authorizeCredentials({ identifier: "c@ecom.test", password: "nope" }, find, limiter, null)).resolves.toBeNull();
    await expect(
      authorizeCredentials({ identifier: "c@ecom.test", password: "Test@12345" }, find, limiter, null),
    ).resolves.toMatchObject({ id: "u1" });
  });

  it("locks an IP that tries many different accounts", async () => {
    const limiter = memoryLimiter();
    for (let i = 0; i < LOGIN_LIMITS.perIp; i++) {
      await authorizeCredentials({ identifier: `x${i}@ecom.test`, password: "nope" }, find, limiter, "9.9.9.9");
    }
    const good = { identifier: "c@ecom.test", password: "Test@12345" };
    await expect(authorizeCredentials(good, find, limiter, "9.9.9.9")).resolves.toBe("locked");
    await expect(authorizeCredentials(good, find, limiter, "8.8.8.8")).resolves.toMatchObject({ id: "u1" });
  });
});

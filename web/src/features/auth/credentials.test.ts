import { describe, expect, it } from "vitest";
import { authorizeCredentials, type FindUserByIdentifier } from "./credentials";
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
});

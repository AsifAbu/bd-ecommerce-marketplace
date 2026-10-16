import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("hashes with bcrypt and verifies the right password", async () => {
    const hash = await hashPassword("Test@12345");
    expect(hash).not.toContain("Test@12345");
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    await expect(verifyPassword("Test@12345", hash)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("Test@12345");
    await expect(verifyPassword("Test@12346", hash)).resolves.toBe(false);
  });

  it("salts each hash", async () => {
    const [a, b] = await Promise.all([hashPassword("same-password"), hashPassword("same-password")]);
    expect(a).not.toBe(b);
  });

  it("rejects users without a password hash", async () => {
    await expect(verifyPassword("anything", null)).resolves.toBe(false);
  });

  it("refuses passwords shorter than 8 characters", async () => {
    await expect(hashPassword("short")).rejects.toThrow(/at least 8/);
  });
});

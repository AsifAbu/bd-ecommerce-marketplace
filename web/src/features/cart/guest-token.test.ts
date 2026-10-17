import { describe, expect, it } from "vitest";
import { guestCookieOptions, hashGuestToken, newGuestToken } from "./guest-token";

describe("guest cart token", () => {
  it("is 32 random bytes; only its SHA-256 is stored", () => {
    const a = newGuestToken();
    const b = newGuestToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
    const hash = hashGuestToken(a);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(a);
    expect(hashGuestToken(a)).toBe(hash);
  });

  it("a missing or malformed cookie is no cart", () => {
    expect(hashGuestToken(undefined)).toBeNull();
    expect(hashGuestToken("")).toBeNull();
    expect(hashGuestToken("short")).toBeNull();
    expect(hashGuestToken(`${"a".repeat(42)};`)).toBeNull();
  });

  it("the cookie is httpOnly, SameSite=Lax and lasts 30 days", () => {
    expect(guestCookieOptions(true)).toEqual({ httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 2592000 });
  });
});

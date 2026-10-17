import { describe, expect, it } from "vitest";
import { addOrderGrant, hasOrderGrant, MAX_ORDER_GRANTS, readPhoneProof, signPhoneProof } from "./tokens";

const SECRET = "test-secret";
const NOW = new Date("2026-10-17T06:00:00Z");
const TTL = 30 * 60_000;

describe("phone proof (guest checkout OTP)", () => {
  it("round-trips the verified mobile within its lifetime", () => {
    const value = signPhoneProof(SECRET, "+8801812345678", NOW);
    expect(readPhoneProof(SECRET, value, new Date(NOW.getTime() + TTL - 1), TTL)).toEqual({ phone: "+8801812345678", verifiedAt: NOW });
  });

  it("expires, and rejects tampering, another secret, garbage or no secret", () => {
    const value = signPhoneProof(SECRET, "+8801812345678", NOW);
    expect(readPhoneProof(SECRET, value, new Date(NOW.getTime() + TTL + 1), TTL)).toBeNull();
    const [p, , at, sig] = value.split(".");
    const forged = [p, Buffer.from("+8801999999999").toString("base64url"), at, sig].join(".");
    expect(readPhoneProof(SECRET, forged, NOW, TTL)).toBeNull();
    expect(readPhoneProof("other", value, NOW, TTL)).toBeNull();
    expect(readPhoneProof("", value, NOW, TTL)).toBeNull();
    for (const bad of [undefined, "", "pp1.x.y", "a.b.c.d"]) expect(readPhoneProof(SECRET, bad, NOW, TTL)).toBeNull();
  });
});

describe("order access grants (guest order page)", () => {
  it("lets this browser open only the granted orders until they expire", () => {
    const value = addOrderGrant(SECRET, undefined, "BD-261017-AAAAA", NOW, TTL);
    expect(hasOrderGrant(SECRET, value, "BD-261017-AAAAA", NOW)).toBe(true);
    expect(hasOrderGrant(SECRET, value, "BD-261017-BBBBB", NOW)).toBe(false);
    expect(hasOrderGrant(SECRET, value, "BD-261017-AAAAA", new Date(NOW.getTime() + TTL))).toBe(false);
  });

  it("rejects an edited order number or expiry", () => {
    const value = addOrderGrant(SECRET, undefined, "BD-261017-AAAAA", NOW, TTL);
    expect(hasOrderGrant(SECRET, value.replace("AAAAA", "BBBBB"), "BD-261017-BBBBB", NOW)).toBe(false);
    const [no, exp, sig] = value.split("~");
    expect(hasOrderGrant(SECRET, [no, Number(exp) + 999_999, sig].join("~"), no, new Date(Number(exp) + 1))).toBe(false);
    expect(hasOrderGrant("other", value, no, NOW)).toBe(false);
  });

  it("keeps the most recent few grants", () => {
    let value: string | undefined;
    for (let i = 0; i < MAX_ORDER_GRANTS + 2; i++) value = addOrderGrant(SECRET, value, `BD-261017-AAAA${"ABCDEFGH"[i]}`, NOW, TTL);
    expect(hasOrderGrant(SECRET, value, "BD-261017-AAAAA", NOW)).toBe(false);
    expect(hasOrderGrant(SECRET, value, "BD-261017-AAAAG", NOW)).toBe(true);
    expect(value!.split(",")).toHaveLength(MAX_ORDER_GRANTS);
  });
});

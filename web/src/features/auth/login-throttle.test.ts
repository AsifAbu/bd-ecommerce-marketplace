import { describe, expect, it } from "vitest";
import { fakeThrottleDeps } from "./fake-login-store";
import { createLoginThrottle, LOGIN_RULES, lockedUntil, loginKey } from "./login-throttle";

const MIN = 60_000;

const KEY = "email:c@ecom.test";

describe("login throttle", () => {
  it("locks an identifier after 5 failures within 15 minutes, for 15 minutes", async () => {
    const f = fakeThrottleDeps();
    const throttle = createLoginThrottle(f);
    for (let i = 0; i < 4; i++) {
      await throttle.recordFailure(KEY, "1.1.1.1");
      f.advance(MIN);
    }
    expect(await throttle.check(KEY, "1.1.1.1")).toEqual({ allowed: true });
    await throttle.recordFailure(KEY, "1.1.1.1"); // 5th failure at +4 min
    expect(await throttle.check(KEY, "1.1.1.1")).toEqual({ allowed: false, reason: "IDENTIFIER_LOCKED", retryAfterSec: 15 * 60 });
    expect(await throttle.check(KEY, "9.9.9.9")).toMatchObject({ reason: "IDENTIFIER_LOCKED" }); // any IP

    f.advance(15 * MIN - 1000);
    expect(await throttle.check(KEY, null)).toEqual({ allowed: false, reason: "IDENTIFIER_LOCKED", retryAfterSec: 1 });
    f.advance(1000);
    expect(await throttle.check(KEY, null)).toEqual({ allowed: true });
  });

  it("does not lock other identifiers", async () => {
    const f = fakeThrottleDeps();
    const throttle = createLoginThrottle(f);
    for (let i = 0; i < 5; i++) await throttle.recordFailure(KEY, null);
    expect(await throttle.check("phone:+8801700000002", null)).toEqual({ allowed: true });
  });

  it("failures spread over more than 15 minutes do not lock", async () => {
    const f = fakeThrottleDeps();
    const throttle = createLoginThrottle(f);
    for (let i = 0; i < 6; i++) {
      await throttle.recordFailure(KEY, null);
      f.advance(4 * MIN); // 5 failures span 16 minutes
    }
    expect(await throttle.check(KEY, null)).toEqual({ allowed: true });
  });

  it("a successful login resets the count", async () => {
    const f = fakeThrottleDeps();
    const throttle = createLoginThrottle(f);
    for (let i = 0; i < 4; i++) await throttle.recordFailure(KEY, null);
    await throttle.recordSuccess(KEY);
    await throttle.recordFailure(KEY, null);
    expect(await throttle.check(KEY, null)).toEqual({ allowed: true });
    expect(f.rows).toHaveLength(1);
  });

  it("caps failures per IP across identifiers", async () => {
    const f = fakeThrottleDeps();
    const throttle = createLoginThrottle(f);
    for (let i = 0; i < LOGIN_RULES.maxFailuresPerIp; i++) await throttle.recordFailure(`email:u${i}@ecom.test`, "2.2.2.2");
    expect(await throttle.check("email:new@ecom.test", "2.2.2.2")).toMatchObject({ allowed: false, reason: "IP_LIMITED" });
    expect(await throttle.check("email:new@ecom.test", "3.3.3.3")).toEqual({ allowed: true });
    expect(await throttle.check("email:new@ecom.test", null)).toEqual({ allowed: true }); // IP unknown: no IP cap
    f.advance(15 * MIN + 1);
    expect(await throttle.check("email:new@ecom.test", "2.2.2.2")).toEqual({ allowed: true });
  });

  it("prunes the identifier's failures that can no longer matter", async () => {
    const f = fakeThrottleDeps();
    const throttle = createLoginThrottle(f);
    await throttle.recordFailure(KEY, null);
    f.advance(31 * MIN);
    await throttle.recordFailure(KEY, null);
    expect(f.rows).toHaveLength(1);
  });

  it("lockedUntil finds any 5 failures within the window", () => {
    const at = (min: number) => new Date(min * MIN);
    expect(lockedUntil([at(0), at(1), at(2), at(3)])).toBe(0);
    expect(lockedUntil([at(0), at(20), at(21), at(22), at(23), at(24)])).toBe(39 * MIN);
    expect(lockedUntil([at(3), at(2), at(1), at(0), at(15)])).toBe(30 * MIN); // order does not matter; 15 min apart still counts
  });

  it("loginKey uses the normalised identifier", () => {
    expect(loginKey({ kind: "email", value: "c@ecom.test" })).toBe(KEY);
    expect(loginKey({ kind: "phone", value: "+8801700000002" })).toBe("phone:+8801700000002");
  });
});

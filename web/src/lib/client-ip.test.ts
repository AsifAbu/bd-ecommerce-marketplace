import { describe, expect, it } from "vitest";
import { ipFromHeaders } from "./client-ip";

describe("ipFromHeaders", () => {
  it("uses the first X-Forwarded-For hop, then X-Real-IP", () => {
    expect(ipFromHeaders(new Headers({ "x-forwarded-for": " 203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(ipFromHeaders(new Headers({ "x-real-ip": "203.0.113.6" }))).toBe("203.0.113.6");
    expect(ipFromHeaders(new Headers())).toBeNull();
  });
});

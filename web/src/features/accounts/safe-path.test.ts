import { describe, expect, it } from "vitest";
import { safePath } from "./safe-path";

const origin = "http://localhost:3300";

describe("safePath", () => {
  it("keeps relative paths", () => {
    expect(safePath("/seller?tab=staff", origin)).toBe("/seller?tab=staff");
  });
  it("accepts absolute URLs on our own origin (Auth.js callbackUrl)", () => {
    expect(safePath("http://localhost:3300/seller", origin)).toBe("/seller");
  });
  it.each(["https://evil.com/x", "//evil.com", "/\\evil.com", "javascript:alert(1)", "http://localhost:3301/seller"])(
    "rejects %s",
    (target) => {
      expect(safePath(target, origin)).toBe("/account");
    },
  );
});

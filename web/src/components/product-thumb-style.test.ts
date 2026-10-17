import { describe, expect, it } from "vitest";
import { initialOf, toneFor } from "./product-thumb-style";

describe("placeholder helpers", () => {
  it("uses the first letter of the title and skips a [TEST] tag", () => {
    expect(initialOf("[TEST] Ryzen 5 processor")).toBe("R");
    expect(initialOf("himu")).toBe("H");
    expect(initialOf("শাড়ি")).toBe("শ");
    expect(initialOf("  !!! ")).toBe("?");
  });

  it("gives the same tone to the same name", () => {
    expect(toneFor("Books")).toBe(toneFor("Books"));
    expect(toneFor("Books")).toMatch(/^bg-/);
  });
});

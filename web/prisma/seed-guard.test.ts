import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSeedAllowed } from "./seed-guard";

describe("assertSeedAllowed", () => {
  afterEach(() => vi.restoreAllMocks());

  it("allows test mode", () => {
    expect(() => assertSeedAllowed({ APP_MODE: "test" })).not.toThrow();
  });

  it("refuses production, and an unset APP_MODE (which means production)", () => {
    expect(() => assertSeedAllowed({ APP_MODE: "production" })).toThrow(/Refusing to seed/);
    expect(() => assertSeedAllowed({})).toThrow(/Refusing to seed/);
    expect(() => assertSeedAllowed({ APP_MODE: "" })).toThrow(/Refusing to seed/);
  });

  it('refuses production when the override is anything but "true"', () => {
    for (const value of ["1", "yes", "TRUE", "", undefined]) {
      expect(() => assertSeedAllowed({ APP_MODE: "production", ALLOW_PRODUCTION_SEED: value })).toThrow(/Refusing to seed/);
    }
  });

  it("allows production only with the explicit override, and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertSeedAllowed({ APP_MODE: "production", ALLOW_PRODUCTION_SEED: "true" })).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/ALLOW_PRODUCTION_SEED=true/));
  });

  it("rejects an invalid APP_MODE like the app does", () => {
    expect(() => assertSeedAllowed({ APP_MODE: "staging" })).toThrow(/Invalid app configuration/);
  });
});

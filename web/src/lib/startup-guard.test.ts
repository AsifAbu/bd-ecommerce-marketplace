import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";
import { assertSafeStartup } from "./startup-guard";

describe("loadConfig", () => {
  it("defaults the dummy OTP on in test mode and off in production", () => {
    expect(loadConfig({ APP_MODE: "test" })).toEqual({ appMode: "test", otpDummyEnabled: true });
    expect(loadConfig({ APP_MODE: "production" })).toEqual({ appMode: "production", otpDummyEnabled: false });
  });

  it("defaults to production when APP_MODE is missing", () => {
    expect(loadConfig({}).appMode).toBe("production");
  });

  it("rejects unknown modes and flag values", () => {
    expect(() => loadConfig({ APP_MODE: "staging" })).toThrow(/Invalid app configuration/);
    expect(() => loadConfig({ APP_MODE: "test", OTP_DUMMY_ENABLED: "yes" })).toThrow(/Invalid app configuration/);
  });
});

describe("assertSafeStartup", () => {
  it("refuses production with the dummy OTP enabled", () => {
    const config = loadConfig({ APP_MODE: "production", OTP_DUMMY_ENABLED: "true" });
    expect(() => assertSafeStartup(config)).toThrow(/Refusing to start/);
  });

  it("allows production without the dummy OTP", () => {
    expect(() => assertSafeStartup(loadConfig({ APP_MODE: "production", OTP_DUMMY_ENABLED: "false" }))).not.toThrow();
  });

  it("allows test mode with or without the dummy OTP", () => {
    expect(() => assertSafeStartup(loadConfig({ APP_MODE: "test" }))).not.toThrow();
    expect(() => assertSafeStartup(loadConfig({ APP_MODE: "test", OTP_DUMMY_ENABLED: "false" }))).not.toThrow();
  });
});

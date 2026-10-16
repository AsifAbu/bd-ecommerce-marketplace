import { describe, expect, it } from "vitest";
import { loadConfig, TEST_DBID_PLACEHOLDER } from "./config";
import { assertSafeStartup } from "./startup-guard";

describe("loadConfig", () => {
  it("defaults the dummy OTP on in test mode and off in production", () => {
    expect(loadConfig({ APP_MODE: "test" })).toMatchObject({ appMode: "test", otpDummyEnabled: true });
    expect(loadConfig({ APP_MODE: "production" })).toMatchObject({ appMode: "production", otpDummyEnabled: false });
  });

  it("defaults to production when APP_MODE is missing", () => {
    expect(loadConfig({}).appMode).toBe("production");
  });

  it("rejects unknown modes and flag values", () => {
    expect(() => loadConfig({ APP_MODE: "staging" })).toThrow(/Invalid app configuration/);
    expect(() => loadConfig({ APP_MODE: "test", OTP_DUMMY_ENABLED: "yes" })).toThrow(/Invalid app configuration/);
  });
});

describe("DBID (US-081)", () => {
  it("uses the test placeholder in test mode when DBID is not set", () => {
    expect(loadConfig({ APP_MODE: "test" }).dbid).toBe(TEST_DBID_PLACEHOLDER);
    expect(loadConfig({ APP_MODE: "test", DBID: " " }).dbid).toBe(TEST_DBID_PLACEHOLDER);
  });

  it("uses the configured DBID in either mode", () => {
    expect(loadConfig({ APP_MODE: "test", DBID: "DBID-123" }).dbid).toBe("DBID-123");
    expect(loadConfig({ APP_MODE: "production", DBID: " DBID-123 " }).dbid).toBe("DBID-123");
  });

  it("has no DBID in production unless it is set", () => {
    expect(loadConfig({ APP_MODE: "production" }).dbid).toBeNull();
  });
});

describe("assertSafeStartup", () => {
  it("refuses production without a DBID", () => {
    const config = loadConfig({ APP_MODE: "production", OTP_DUMMY_ENABLED: "false" });
    expect(() => assertSafeStartup(config)).toThrow(/without a DBID/);
  });

  it("refuses production with the dummy OTP enabled", () => {
    const config = loadConfig({ APP_MODE: "production", OTP_DUMMY_ENABLED: "true" });
    expect(() => assertSafeStartup(config)).toThrow(/Refusing to start/);
  });

  it("allows production without the dummy OTP", () => {
    expect(() => assertSafeStartup(loadConfig({ APP_MODE: "production", OTP_DUMMY_ENABLED: "false", DBID: "DBID-1" }))).not.toThrow();
  });

  it("allows test mode with or without the dummy OTP", () => {
    expect(() => assertSafeStartup(loadConfig({ APP_MODE: "test" }))).not.toThrow();
    expect(() => assertSafeStartup(loadConfig({ APP_MODE: "test", OTP_DUMMY_ENABLED: "false" }))).not.toThrow();
  });
});

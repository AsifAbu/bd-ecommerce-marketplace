import { describe, expect, it } from "vitest";
import { createOtpProvider, TEST_OTP_CODE } from "./index";
import { TestOtpProvider } from "./test-provider";
import { ProductionOtpProvider } from "./production-provider";

describe("TestOtpProvider", () => {
  const otp = new TestOtpProvider();

  it("accepts 123456 for any phone", async () => {
    expect(TEST_OTP_CODE).toBe("123456");
    await expect(otp.verify("+8801700000002", "123456")).resolves.toBe(true);
    await expect(otp.verify("+8801999999999", " 123456 ")).resolves.toBe(true);
  });

  it("rejects any other code", async () => {
    for (const code of ["", "000000", "12345", "1234567", "654321"]) {
      await expect(otp.verify("+8801700000002", code)).resolves.toBe(false);
    }
  });

  it("sends without an SMS provider", async () => {
    await expect(otp.send("+8801700000002")).resolves.toBeUndefined();
  });
});

describe("ProductionOtpProvider", () => {
  it("throws until an SMS provider is configured", async () => {
    const otp = new ProductionOtpProvider();
    await expect(otp.send()).rejects.toThrow("SMS provider not configured");
    await expect(otp.verify()).rejects.toThrow("SMS provider not configured");
  });
});

describe("createOtpProvider", () => {
  it("uses the dummy provider only in test mode with the dummy OTP enabled", () => {
    expect(createOtpProvider({ appMode: "test", otpDummyEnabled: true }).name).toBe("test");
    expect(createOtpProvider({ appMode: "test", otpDummyEnabled: false }).name).toBe("production");
    expect(createOtpProvider({ appMode: "production", otpDummyEnabled: false }).name).toBe("production");
    expect(createOtpProvider({ appMode: "production", otpDummyEnabled: true }).name).toBe("production");
  });
});

import { describe, expect, it, vi } from "vitest";
import { createSmsProvider, ProductionSmsProvider, TestSmsProvider } from "./index";

describe("SMS adapter", () => {
  it("logs instead of sending in test mode", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const sms = createSmsProvider({ appMode: "test", otpDummyEnabled: true });
    expect(sms).toBeInstanceOf(TestSmsProvider);
    await sms.send("+8801700000002", "Order BD-261017-7KQ2M placed");
    expect(info).toHaveBeenCalledWith(expect.stringContaining("Order BD-261017-7KQ2M placed"));
    info.mockRestore();
  });

  it("fails in production until a gateway is configured", async () => {
    const sms = createSmsProvider({ appMode: "production", otpDummyEnabled: false });
    expect(sms).toBeInstanceOf(ProductionSmsProvider);
    await expect(sms.send("+8801700000002", "x")).rejects.toThrow("SMS provider not configured");
  });
});

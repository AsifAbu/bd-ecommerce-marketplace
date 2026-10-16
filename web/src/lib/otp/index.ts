import { getConfig, type AppConfig } from "../config";
import { ProductionOtpProvider } from "./production-provider";
import { TestOtpProvider } from "./test-provider";
import type { OtpProvider } from "./types";

export type { OtpProvider } from "./types";
export { TEST_OTP_CODE } from "./test-provider";

/** The dummy provider is used only in test mode with OTP_DUMMY_ENABLED on. */
export function createOtpProvider(config: AppConfig = getConfig()): OtpProvider {
  if (config.appMode === "test" && config.otpDummyEnabled) {
    return new TestOtpProvider();
  }
  return new ProductionOtpProvider();
}

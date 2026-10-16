import type { OtpProvider } from "./types";

/** Test mode only: no SMS is sent and the code is always 123456. */
export const TEST_OTP_CODE = "123456";

export class TestOtpProvider implements OtpProvider {
  readonly name = "test";

  async send(phone: string): Promise<void> {
    console.info(`[otp:test] OTP for ${phone} is ${TEST_OTP_CODE} (no SMS sent)`);
  }

  async verify(_phone: string, code: string): Promise<boolean> {
    return code.trim() === TEST_OTP_CODE;
  }
}

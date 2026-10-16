import type { OtpProvider } from "./types";

/** Placeholder until a Bangladeshi SMS gateway is chosen (pre-release checklist). */
export class ProductionOtpProvider implements OtpProvider {
  readonly name = "production";

  async send(): Promise<void> {
    throw new Error("SMS provider not configured");
  }

  async verify(): Promise<boolean> {
    throw new Error("SMS provider not configured");
  }
}

import { getConfig, type AppConfig } from "../config";

/**
 * Text messages (order confirmations) behind an adapter (ADR-007), like the OTP provider.
 * Test mode logs the message and sends nothing. Production throws until a Bangladeshi SMS
 * gateway is chosen (pre-release checklist), so a job using it fails and is retried.
 */
export interface SmsProvider {
  readonly name: string;
  send(phone: string, text: string): Promise<void>;
}

export class TestSmsProvider implements SmsProvider {
  readonly name = "test";
  async send(phone: string, text: string): Promise<void> {
    console.info(`[sms:test] to ${phone} (not sent): ${text}`);
  }
}

export class ProductionSmsProvider implements SmsProvider {
  readonly name = "production";
  async send(): Promise<void> {
    throw new Error("SMS provider not configured");
  }
}

export function createSmsProvider(config: AppConfig = getConfig()): SmsProvider {
  return config.appMode === "test" ? new TestSmsProvider() : new ProductionSmsProvider();
}

import { z } from "zod";

/**
 * App-wide runtime configuration. Read once from environment variables.
 * APP_MODE=test enables the "Test mode" banner and (by default) the dummy OTP.
 */
export type AppMode = "test" | "production";

export interface AppConfig {
  appMode: AppMode;
  /** Dummy OTP 123456 accepted, no SMS sent. Defaults to true in test mode, false otherwise. */
  otpDummyEnabled: boolean;
}

const boolString = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const envSchema = z.object({
  APP_MODE: z.enum(["test", "production"]).default("production"),
  OTP_DUMMY_ENABLED: boolString.optional(),
});

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = envSchema.safeParse({
    APP_MODE: env.APP_MODE || undefined,
    OTP_DUMMY_ENABLED: env.OTP_DUMMY_ENABLED || undefined,
  });
  if (!parsed.success) {
    throw new Error(`Invalid app configuration: ${parsed.error.message}`);
  }
  const { APP_MODE, OTP_DUMMY_ENABLED } = parsed.data;
  return {
    appMode: APP_MODE,
    otpDummyEnabled: OTP_DUMMY_ENABLED ?? APP_MODE === "test",
  };
}

let cached: AppConfig | undefined;

/** Cached config for app code. Tests should call loadConfig() with an explicit env. */
export function getConfig(): AppConfig {
  cached ??= loadConfig();
  return cached;
}

export const isTestMode = () => getConfig().appMode === "test";

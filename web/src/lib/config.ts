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
  /**
   * Digital Business Identity number shown in the site footer (DBID guideline 2022).
   * Test mode falls back to TEST_DBID_PLACEHOLDER; production must set DBID (startup guard).
   */
  dbid?: string | null;
}

/** Shown in the footer in test mode when DBID is not set. Never a real number. */
export const TEST_DBID_PLACEHOLDER = "TEST-DBID-0000000000";

const boolString = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const envSchema = z.object({
  APP_MODE: z.enum(["test", "production"]).default("production"),
  OTP_DUMMY_ENABLED: boolString.optional(),
  DBID: z.string().trim().min(1).max(64).optional(),
});

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = envSchema.safeParse({
    APP_MODE: env.APP_MODE || undefined,
    OTP_DUMMY_ENABLED: env.OTP_DUMMY_ENABLED || undefined,
    DBID: env.DBID?.trim() || undefined,
  });
  if (!parsed.success) {
    throw new Error(`Invalid app configuration: ${parsed.error.message}`);
  }
  const { APP_MODE, OTP_DUMMY_ENABLED, DBID } = parsed.data;
  return {
    appMode: APP_MODE,
    otpDummyEnabled: OTP_DUMMY_ENABLED ?? APP_MODE === "test",
    dbid: DBID ?? (APP_MODE === "test" ? TEST_DBID_PLACEHOLDER : null),
  };
}

let cached: AppConfig | undefined;

/** Cached config for app code. Tests should call loadConfig() with an explicit env. */
export function getConfig(): AppConfig {
  cached ??= loadConfig();
  return cached;
}

export const isTestMode = () => getConfig().appMode === "test";

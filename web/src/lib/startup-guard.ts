import type { AppConfig } from "./config";

/**
 * Refuses to start the app (web server or worker) with unsafe settings.
 * Called from src/instrumentation.ts and src/worker.ts.
 */
export function assertSafeStartup(config: AppConfig): void {
  if (config.appMode === "production" && config.otpDummyEnabled) {
    throw new Error(
      "Refusing to start: APP_MODE=production with the dummy OTP enabled. Set OTP_DUMMY_ENABLED=false.",
    );
  }
}

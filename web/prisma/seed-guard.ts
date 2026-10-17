import { loadConfig } from "../src/lib/config";

/** Set to "true" to seed a production database on purpose (e.g. a one-off demo). Never set it by default. */
export const SEED_OVERRIDE_ENV = "ALLOW_PRODUCTION_SEED";

/**
 * The seed writes test users with a known password, so it must not run against production.
 * APP_MODE is read with loadConfig(), like the app: unset means production.
 * Throws unless APP_MODE=test or the override is set to exactly "true".
 */
export function assertSeedAllowed(env: Record<string, string | undefined> = process.env): void {
  if (loadConfig(env).appMode !== "production") return;
  if (env[SEED_OVERRIDE_ENV] === "true") {
    console.warn(`WARNING: seeding with APP_MODE=production because ${SEED_OVERRIDE_ENV}=true.`);
    return;
  }
  throw new Error(
    "Refusing to seed: APP_MODE is production (or unset). The seed creates test accounts with a known password. " +
      `Set APP_MODE=test, or ${SEED_OVERRIDE_ENV}=true if you really mean to seed this database.`,
  );
}

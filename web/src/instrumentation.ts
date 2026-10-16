import { getConfig } from "@/lib/config";
import { assertSafeStartup } from "@/lib/startup-guard";

/** Runs once when the server starts. Exits the process on unsafe settings. */
export function register() {
  try {
    assertSafeStartup(getConfig());
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    if (process.env.NEXT_RUNTIME === "nodejs") process.exit(1);
    throw err;
  }
}

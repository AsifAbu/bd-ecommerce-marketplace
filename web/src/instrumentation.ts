import { getConfig } from "@/lib/config";
import { assertSafeStartup } from "@/lib/startup-guard";

/** Runs once when the server starts. Exits the process on unsafe settings. */
export async function register() {
  try {
    assertSafeStartup(getConfig());
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    if (process.env.NEXT_RUNTIME === "nodejs") process.exit(1);
    throw err;
  }

  // Create the private storage bucket if missing. Not fatal: uploads retry it on first use.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { getStorage } = await import("@/lib/storage");
      await getStorage().ensureBucket();
    } catch (err) {
      console.warn("[storage] bucket not ready:", err instanceof Error ? err.message : err);
    }
  }
}

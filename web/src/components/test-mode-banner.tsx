import { connection } from "next/server";
import { getConfig } from "@/lib/config";

/** Shown on every page when APP_MODE=test, so test data is never mistaken for real orders. Slim, but always visible. */
export async function TestModeBanner() {
  await connection(); // read APP_MODE at request time, not build time
  if (getConfig().appMode !== "test") return null;
  return (
    <div
      role="status"
      data-testid="test-mode-banner"
      className="w-full bg-gold px-4 py-1 text-center text-xs font-medium text-ink sm:text-sm"
    >
      Test mode: orders, shops and accounts on this site are test data. OTP code is 123456.
    </div>
  );
}

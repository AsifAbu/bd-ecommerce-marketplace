import { connection } from "next/server";
import { getConfig } from "@/lib/config";

/** Shown on every page when APP_MODE=test, so test data is never mistaken for real orders. */
export async function TestModeBanner() {
  await connection(); // read APP_MODE at request time, not build time
  if (getConfig().appMode !== "test") return null;
  return (
    <div
      role="status"
      data-testid="test-mode-banner"
      className="w-full bg-amber-400 px-4 py-1.5 text-center text-sm font-semibold text-black"
    >
      Test mode: orders, shops and accounts on this site are test data. OTP code is 123456.
    </div>
  );
}

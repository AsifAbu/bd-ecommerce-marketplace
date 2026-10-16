import { cookies } from "next/headers";
import { connection } from "next/server";
import { COOKIE_POLICY_SLUG } from "../catalog";
import { COOKIE_NOTICE_COOKIE, shouldShowCookieNotice } from "../cookie-notice";
import { policyService } from "../server";
import { CookieNoticeBanner } from "./cookie-notice-banner";

/** Cookie notice for every page (root layout, inside <Suspense>). Hidden once dismissed for this Cookie Policy version. */
export async function CookieNotice() {
  await connection();
  const dismissed = (await cookies()).get(COOKIE_NOTICE_COOKIE)?.value;
  let version: number | null = null;
  try {
    version = (await policyService.getCurrentPolicy(COOKIE_POLICY_SLUG))?.version ?? null;
  } catch (err) {
    // The notice must never break a page; show it without a version if the database is unreachable.
    console.error("[policies] cookie policy lookup failed", err);
  }
  if (!shouldShowCookieNotice(dismissed, version)) return null;
  return <CookieNoticeBanner version={version} />;
}

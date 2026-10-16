/**
 * Cookie notice (US-080, Guidelines 2021: "cookies disclosed"). A dismissible banner links the
 * Cookie Policy. Dismissing stores the Cookie Policy version in a first-party cookie, so the
 * banner stays hidden until a newer Cookie Policy version takes effect.
 */
export const COOKIE_NOTICE_COOKIE = "cookie_notice";

/** One year. */
export const COOKIE_NOTICE_MAX_AGE = 365 * 24 * 60 * 60;

export function cookieNoticeOptions(production: boolean) {
  return {
    path: "/",
    maxAge: COOKIE_NOTICE_MAX_AGE,
    sameSite: "lax" as const,
    httpOnly: true,
    secure: production,
  };
}

/** The value stored on dismissal: the Cookie Policy version seen ("0" when none is published). */
export function cookieNoticeValue(cookiePolicyVersion: number | null): string {
  return String(cookiePolicyVersion ?? 0);
}

/**
 * Show the banner unless the visitor dismissed it for the current Cookie Policy version (or a
 * later one). Malformed values count as not dismissed.
 */
export function shouldShowCookieNotice(cookieValue: string | undefined, cookiePolicyVersion: number | null): boolean {
  if (!cookieValue || !/^\d{1,6}$/.test(cookieValue)) return true;
  return Number(cookieValue) < (cookiePolicyVersion ?? 0);
}

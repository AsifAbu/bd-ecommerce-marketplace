import { createHash, randomBytes } from "node:crypto";

/**
 * Guest cart device token. The httpOnly, SameSite=Lax cookie holds 32 random bytes; the database
 * keeps only their SHA-256, so a leaked database row can't be turned back into a cookie.
 */

export const GUEST_COOKIE = "cart_guest";
/** The delivery zone the customer chose on the cart page. */
export const ZONE_COOKIE = "cart_zone";
/** Guest carts (and the cookie) last 30 days after the last change. */
export const GUEST_CART_DAYS = 30;
export const GUEST_CART_MAX_AGE = GUEST_CART_DAYS * 24 * 60 * 60;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/; // 32 bytes, base64url without padding

export function newGuestToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The stored form of a cookie value, or null for a malformed value (treated as no cart). */
export function hashGuestToken(cookieValue: string | undefined | null): string | null {
  if (!cookieValue || !TOKEN_PATTERN.test(cookieValue)) return null;
  return createHash("sha256").update(cookieValue).digest("hex");
}

export function guestCookieOptions(secure: boolean) {
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge: GUEST_CART_MAX_AGE };
}

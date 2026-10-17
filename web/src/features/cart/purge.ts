import { GUEST_CART_DAYS } from "./guest-token";
import { purgeGuestCarts } from "./repo";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The cutoff for stale guest carts: rows untouched for GUEST_CART_DAYS (the cookie's lifetime). */
export function guestCartCutoff(now: Date): Date {
  return new Date(now.getTime() - GUEST_CART_DAYS * DAY_MS);
}

/** Daily job `cart.purge-guest-carts`: removes guest carts whose cookie has expired. */
export function purgeStaleGuestCarts(now: Date): Promise<number> {
  return purgeGuestCarts(guestCartCutoff(now));
}

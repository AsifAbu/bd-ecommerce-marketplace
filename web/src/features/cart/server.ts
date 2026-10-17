import { cookies } from "next/headers";
import { getCategorySchema } from "@/features/catalog";
import { wishlistService } from "@/features/wishlist/server";
import { requireUser, UnauthorizedError, type GuardUser } from "@/lib/auth";
import type { DeliveryZone } from "@/lib/delivery";
import { createCartApi } from "./api";
import { GUEST_COOKIE, guestCookieOptions, hashGuestToken, newGuestToken, ZONE_COOKIE } from "./guest-token";
import { resolveZone, type ZoneSource } from "./model";
import * as repo from "./repo";
import { createCartService, type CartOwner, type CartRepo } from "./service";

/**
 * The cart wired to the session, cookies and database. Route handlers, pages, the header and
 * (US-051) checkout use these. Cookies can only be written in route handlers and server
 * actions; pages pass `writable: false`.
 */

export const cartService = createCartService({ repo: repo satisfies CartRepo, getCategorySchema, now: () => new Date() });

const secureCookies = () => (process.env.AUTH_URL ?? "").startsWith("https://");

/** The logged-in, active user, or null for a guest. */
export async function currentUserOrNull(): Promise<GuardUser | null> {
  try {
    return await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) return null;
    throw err;
  }
}

/**
 * Merges this device's guest cart into the user's cart. With `writable`, the guest cookie is
 * removed too (route handlers, server actions, the Auth.js sign-in event).
 */
export async function mergeGuestCartInto(userId: string, opts: { writable: boolean }) {
  const store = await cookies();
  const value = store.get(GUEST_COOKIE)?.value;
  if (value === undefined) return null;
  const token = hashGuestToken(value);
  const result = token ? await cartService.mergeGuestCart(token, userId) : null;
  if (opts.writable) store.delete(GUEST_COOKIE);
  return result;
}

/**
 * Whose cart this request is: the logged-in user (after merging any guest cart left on the
 * device), else the guest device. With `create`, a guest without a cookie gets one (writable
 * contexts only); without it such a guest has no cart (null). `merge: false` skips the merge
 * (the header, which renders on every page).
 */
export async function resolveCartOwner(opts: { create?: boolean; writable: boolean; merge?: boolean }): Promise<CartOwner | null> {
  const user = await currentUserOrNull();
  if (user) {
    // Normally done at login (auth.ts); this catches a guest cart created in another tab since.
    if (opts.merge !== false) await mergeGuestCartInto(user.id, { writable: opts.writable });
    return { kind: "user", userId: user.id };
  }
  const store = await cookies();
  const current = store.get(GUEST_COOKIE)?.value;
  const token = hashGuestToken(current);
  if (token && current) {
    // Each add keeps the guest cart for another 30 days (the purge job counts from the last change).
    if (opts.create && opts.writable) store.set(GUEST_COOKIE, current, guestCookieOptions(secureCookies()));
    return { kind: "guest", guestToken: token };
  }
  if (!opts.create || !opts.writable) return null;
  const value = newGuestToken();
  store.set(GUEST_COOKIE, value, guestCookieOptions(secureCookies()));
  return { kind: "guest", guestToken: hashGuestToken(value)! };
}

/** The delivery zone for the cart: the cart page choice, else the default address, else inside Dhaka. */
export async function resolveDeliveryZone(
  owner: CartOwner | null,
  override?: unknown,
): Promise<{ zone: DeliveryZone; source: ZoneSource }> {
  const chosen = override ?? (await cookies()).get(ZONE_COOKIE)?.value;
  const defaultAddress = owner?.kind === "user" ? await repo.findDefaultAddress(owner.userId) : null;
  return resolveZone({ chosen, defaultAddress });
}

export const cartApi = createCartApi({
  resolveOwner: resolveCartOwner,
  requireUser,
  resolveZone: resolveDeliveryZone,
  mergeGuestCart: (userId) => mergeGuestCartInto(userId, { writable: true }),
  moveToCart: wishlistService.moveToCart,
  service: cartService,
});

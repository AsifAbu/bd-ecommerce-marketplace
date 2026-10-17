import { mergeGuestCartInto } from "./server";

/**
 * Called by the Auth.js `signIn` event (src/auth.ts) in the login or sign-up request: the guest
 * cart on this device joins the account cart and the guest cookie is removed. A failure never
 * blocks the login; the next cart request merges again (resolveCartOwner).
 */
export async function mergeGuestCartAtLogin(userId: string | undefined): Promise<void> {
  if (!userId) return;
  try {
    await mergeGuestCartInto(userId, { writable: true });
  } catch (err) {
    console.error("[cart] guest cart merge at login failed", err);
  }
}

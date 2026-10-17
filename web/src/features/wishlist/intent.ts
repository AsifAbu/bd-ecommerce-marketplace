/**
 * Guest wishlist intent (US-057): a guest who taps the heart is sent to log in with a
 * callbackUrl back to the product page carrying `wishlist=add` (and the chosen `variant`).
 * After login the product page sees the intent and saves the item on the server, so nothing
 * is kept in the browser. Pure and safe to import in client components.
 */

export const INTENT_PARAM = "wishlist";
export const INTENT_ADD = "add";
export const VARIANT_PARAM = "variant";

const ID = /^[A-Za-z0-9_-]{1,64}$/;

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** /products/<id>?variant=<variantId> */
export function productPath(productId: string, variantId?: string | null, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams(extra);
  if (variantId) params.set(VARIANT_PARAM, variantId);
  const query = params.toString();
  return `/products/${encodeURIComponent(productId)}${query ? `?${query}` : ""}`;
}

/** Where a guest goes when they tap the heart: login, then back to the product to save it. */
export function wishlistLoginUrl(productId: string, variantId: string | null): string {
  const back = productPath(productId, variantId, { [INTENT_PARAM]: INTENT_ADD });
  return `/login?callbackUrl=${encodeURIComponent(back)}`;
}

/** The intent in the product page's query, or null. A malformed variant id is dropped. */
export function parseWishlistIntent(params: SearchParams): { variantId: string | null } | null {
  if (first(params[INTENT_PARAM]) !== INTENT_ADD) return null;
  const variant = first(params[VARIANT_PARAM]);
  return { variantId: variant && ID.test(variant) ? variant : null };
}

export type IntentResult = "saved" | "failed" | null;

/**
 * Called by the product page after login: saves the intended item for the user. Guests and
 * pages without an intent get null. Idempotent (addItem returns the existing row), so a reload
 * does no harm.
 */
export async function applyWishlistIntent(
  user: { id: string } | null,
  productId: string,
  intent: { variantId: string | null } | null,
  addItem: (userId: string, body: { productId: string; variantId: string | null }) => Promise<unknown>,
): Promise<IntentResult> {
  if (!user || !intent) return null;
  try {
    await addItem(user.id, { productId, variantId: intent.variantId });
    return "saved";
  } catch {
    return "failed";
  }
}

/** The query string without the intent (kept: the chosen variant). */
export function withoutIntent(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(INTENT_PARAM);
  const query = params.toString();
  return query ? `?${query}` : "";
}

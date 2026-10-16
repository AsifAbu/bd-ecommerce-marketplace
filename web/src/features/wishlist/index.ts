/**
 * Public entry of the wishlist feature (US-057). Pure code and types only; the database-wired
 * service is in `./server` (`wishlistService`, used by route handlers, pages and the cart).
 */
export { WishlistError } from "./errors";
export { applyWishlistIntent, parseWishlistIntent, productPath, wishlistLoginUrl, type IntentResult } from "./intent";
export {
  createWishlistService,
  itemState,
  MAX_WISHLIST_ITEMS,
  type CartAdder,
  type CartLine,
  type WishlistItemView,
  type WishlistService,
} from "./service";

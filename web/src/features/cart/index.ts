/**
 * Public entry of the cart feature (US-050, US-056, US-058). Pure code and types only; the
 * database- and cookie-wired service is in `./server`:
 *   resolveCartOwner({ writable })   whose cart this request is (user, or guest device)
 *   resolveDeliveryZone(owner)       inside / outside Dhaka for the delivery charges
 *   cartService.getCart(owner, zone) the cart grouped by shop with delivery charges
 *   cartService.clearItems(owner, ids) remove the ordered lines after checkout
 * and here `cartOwnerWhere(owner)`: the Prisma filter for one owner's rows (checkout clears the
 * ordered lines with it inside the order transaction).
 */
export { CartError } from "./errors";
export { ownerWhere as cartOwnerWhere } from "./owner";
export {
  buildCart,
  cartReadyForCheckout,
  DELIVERY_ZONES,
  isInsideDhaka,
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  parseZone,
  resolveZone,
  ZONE_LABELS,
  type Cart,
  type CartLine,
  type CartRow,
  type LineStatus,
  type Readiness,
  type ShopGroup,
  type ZoneSource,
} from "./model";
export { createCartService, type CartOwner, type CartRepo, type CartService, type ItemResult, type MergeResult } from "./service";

import { cartApi } from "@/features/cart/server";

/** US-057: move one of the customer's wishlist items into their cart ({ variantId?, quantity? }). */
export async function POST(req: Request, ctx: RouteContext<"/api/wishlist/[itemId]/move-to-cart">) {
  const { itemId } = await ctx.params;
  return cartApi.moveToCart(req, itemId);
}

import { wishlistApi } from "@/features/wishlist/server";

/** US-057: remove one of the logged-in customer's wishlist items (404 if not theirs). */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/wishlist/[itemId]">) {
  const { itemId } = await ctx.params;
  return wishlistApi.remove(itemId);
}

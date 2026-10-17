import { cartApi } from "@/features/cart/server";

/** US-056: change { quantity?, savedForLater?, acknowledgePrice? } of one of the owner's lines (404 if not theirs). */
export async function PATCH(req: Request, ctx: RouteContext<"/api/cart/items/[id]">) {
  const { id } = await ctx.params;
  return cartApi.update(req, id);
}

/** US-056: remove one of the owner's lines (404 if not theirs). */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/cart/items/[id]">) {
  const { id } = await ctx.params;
  return cartApi.remove(id);
}

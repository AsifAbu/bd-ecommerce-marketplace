import { lifecycleApi } from "@/features/orders/lifecycle/server";

/** US-053: { action: confirm | pack | hand_over | deliver | refuse | cancel | mark_returned, reason?, courierName?, trackingNo? }. */
export async function POST(req: Request, ctx: RouteContext<"/api/shops/[shopId]/orders/[shopOrderId]/status">) {
  const { shopId, shopOrderId } = await ctx.params;
  return lifecycleApi.transitionShop(req, shopId, shopOrderId);
}

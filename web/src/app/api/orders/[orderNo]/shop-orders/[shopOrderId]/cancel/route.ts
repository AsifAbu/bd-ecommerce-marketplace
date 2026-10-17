import { lifecycleApi } from "@/features/orders/lifecycle/server";

/** US-053: the customer cancels a shop order the shop has not confirmed yet ({ reason? }); own order or guest grant. */
export async function POST(req: Request, ctx: RouteContext<"/api/orders/[orderNo]/shop-orders/[shopOrderId]/cancel">) {
  const { orderNo, shopOrderId } = await ctx.params;
  return lifecycleApi.cancelAsCustomer(req, decodeURIComponent(orderNo), shopOrderId);
}

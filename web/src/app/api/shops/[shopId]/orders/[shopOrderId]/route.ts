import { connection } from "next/server";
import { lifecycleApi } from "@/features/orders/lifecycle/server";

/** US-053: one shop order of this shop with its timeline and the actions the member may take (404 for another shop's). */
export async function GET(_req: Request, ctx: RouteContext<"/api/shops/[shopId]/orders/[shopOrderId]">) {
  await connection();
  const { shopId, shopOrderId } = await ctx.params;
  return lifecycleApi.getShop(shopId, shopOrderId);
}

import { connection } from "next/server";
import { lifecycleApi } from "@/features/orders/lifecycle/server";

/** US-053: the shop's orders (owner/staff), `?status=` and `?overdue=1` filters. */
export async function GET(req: Request, ctx: RouteContext<"/api/shops/[shopId]/orders">) {
  await connection();
  const { shopId } = await ctx.params;
  return lifecycleApi.listShop(req, shopId);
}

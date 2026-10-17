import { connection } from "next/server";
import { returnsApi } from "@/features/returns/server";

/** US-071: the shop's return requests (owner or staff), ?status= to filter. */
export async function GET(req: Request, ctx: RouteContext<"/api/shops/[shopId]/returns">) {
  await connection();
  const { shopId } = await ctx.params;
  return returnsApi.shopList(req, shopId);
}

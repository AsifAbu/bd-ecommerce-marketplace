import { connection } from "next/server";
import { returnsApi } from "@/features/returns/server";

/** US-071: accept, reject, mark received or record the refund (owner or staff of this shop). */
export async function PATCH(req: Request, ctx: RouteContext<"/api/shops/[shopId]/returns/[returnId]">) {
  await connection();
  const { shopId, returnId } = await ctx.params;
  return returnsApi.shopUpdate(req, shopId, returnId);
}

import { connection } from "next/server";
import { complaintsApi } from "@/features/complaints/server";

/** US-072: complaints about this shop's orders (owner or staff). */
export async function GET(_req: Request, ctx: RouteContext<"/api/shops/[shopId]/complaints">) {
  await connection();
  const { shopId } = await ctx.params;
  return complaintsApi.shopList(shopId);
}

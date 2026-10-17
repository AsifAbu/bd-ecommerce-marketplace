import { connection } from "next/server";
import { payoutsApi } from "@/features/payouts/server";

/** US-082: the shop's cash collections, due dates and payouts (shop owner only). */
export async function GET(_req: Request, ctx: RouteContext<"/api/shops/[shopId]/payouts">) {
  await connection();
  const { shopId } = await ctx.params;
  return payoutsApi.shopLedger(shopId);
}

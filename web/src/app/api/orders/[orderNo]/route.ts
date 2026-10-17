import { connection } from "next/server";
import { ordersApi } from "@/features/orders/server";

/** US-052 / US-008: one order: the user's own, or one this browser placed or tracked (404 otherwise). */
export async function GET(_req: Request, ctx: RouteContext<"/api/orders/[orderNo]">) {
  await connection();
  const { orderNo } = await ctx.params;
  return ordersApi.getOrder(decodeURIComponent(orderNo));
}

import { connection } from "next/server";
import { complaintsApi } from "@/features/complaints/server";

/** One complaint about this shop's order, with its thread (owner or staff). */
export async function GET(_req: Request, ctx: RouteContext<"/api/shops/[shopId]/complaints/[ticketId]">) {
  await connection();
  const { shopId, ticketId } = await ctx.params;
  return complaintsApi.shopGet(shopId, ticketId);
}

/** The shop replies in the thread: { text }. */
export async function POST(req: Request, ctx: RouteContext<"/api/shops/[shopId]/complaints/[ticketId]">) {
  await connection();
  const { shopId, ticketId } = await ctx.params;
  return complaintsApi.shopReply(req, shopId, ticketId);
}

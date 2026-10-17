import { connection } from "next/server";
import { complaintsApi } from "@/features/complaints/server";

/** One complaint with its thread (the customer, or a guest with its order open). */
export async function GET(_req: Request, ctx: RouteContext<"/api/complaints/[ticketId]">) {
  await connection();
  const { ticketId } = await ctx.params;
  return complaintsApi.get(ticketId);
}

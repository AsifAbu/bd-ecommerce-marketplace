import { connection } from "next/server";
import { complaintsApi } from "@/features/complaints/server";

/** The customer replies in the thread: { text }. */
export async function POST(req: Request, ctx: RouteContext<"/api/complaints/[ticketId]/messages">) {
  await connection();
  const { ticketId } = await ctx.params;
  return complaintsApi.customerReply(req, ticketId);
}

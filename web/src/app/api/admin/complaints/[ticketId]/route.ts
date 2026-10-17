import { connection } from "next/server";
import { complaintsApi } from "@/features/complaints/server";

/** Platform Admin: one complaint with its thread. */
export async function GET(_req: Request, ctx: RouteContext<"/api/admin/complaints/[ticketId]">) {
  await connection();
  const { ticketId } = await ctx.params;
  return complaintsApi.adminGet(ticketId);
}

/** Platform Admin: { action: "reply", text } | { action: "start" } | { action: "resolve" | "close", resolution }. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/complaints/[ticketId]">) {
  await connection();
  const { ticketId } = await ctx.params;
  return complaintsApi.adminUpdate(req, ticketId);
}

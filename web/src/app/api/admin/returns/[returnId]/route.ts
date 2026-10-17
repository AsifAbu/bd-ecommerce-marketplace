import { connection } from "next/server";
import { returnsApi } from "@/features/returns/server";

/** Platform Admin: approve or deny an escalated return, or mark received / record the refund. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/returns/[returnId]">) {
  await connection();
  const { returnId } = await ctx.params;
  return returnsApi.adminUpdate(req, returnId);
}

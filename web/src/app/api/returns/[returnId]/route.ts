import { connection } from "next/server";
import { returnsApi } from "@/features/returns/server";

/** The customer cancels a waiting request or sends a rejected one to the admin: { action: "cancel" | "dispute", note? }. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/returns/[returnId]">) {
  await connection();
  const { returnId } = await ctx.params;
  return returnsApi.customerUpdate(req, returnId);
}

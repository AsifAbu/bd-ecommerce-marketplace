import { reviewsApi } from "@/features/reviews/server";

/** US-055: Platform Admin hides a review { reason } (audit log). */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/reviews/[id]/hide">) {
  const { id } = await ctx.params;
  return reviewsApi.hide(req, id);
}

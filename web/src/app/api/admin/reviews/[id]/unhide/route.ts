import { reviewsApi } from "@/features/reviews/server";

/** US-055: Platform Admin shows a hidden review again { reason } (audit log). */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/reviews/[id]/unhide">) {
  const { id } = await ctx.params;
  return reviewsApi.unhide(req, id);
}

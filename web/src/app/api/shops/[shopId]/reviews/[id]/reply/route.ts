import { reviewsApi } from "@/features/reviews/server";

/** US-055: the shop's owner or staff replies publicly to a review of the shop's product { text }. */
export async function PUT(req: Request, ctx: RouteContext<"/api/shops/[shopId]/reviews/[id]/reply">) {
  const { shopId, id } = await ctx.params;
  return reviewsApi.reply(req, shopId, id);
}

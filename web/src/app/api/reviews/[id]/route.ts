import { reviewsApi } from "@/features/reviews/server";

/** US-055: the author edits their review { rating?, title?, text? } within 30 days. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/reviews/[id]">) {
  const { id } = await ctx.params;
  return reviewsApi.update(req, id);
}

/** Reviews are never deleted (Guidelines 2021): always 405 REVIEW_NOT_DELETABLE. */
export async function DELETE() {
  return reviewsApi.remove();
}

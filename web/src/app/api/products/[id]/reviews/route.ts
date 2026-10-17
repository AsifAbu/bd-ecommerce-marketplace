import { connection } from "next/server";
import { reviewsApi } from "@/features/reviews/server";

/** US-055: a live product's rating and a page (?page=n, 10 per page) of its visible reviews. */
export async function GET(req: Request, ctx: RouteContext<"/api/products/[id]/reviews">) {
  await connection();
  const { id } = await ctx.params;
  return reviewsApi.listForProduct(req, id);
}

import { readJson, respond } from "@/features/products/http";
import { productService } from "@/features/products/server";

/** US-033: { status: "active" | "inactive" }. */
export async function PUT(req: Request, ctx: RouteContext<"/api/shops/[shopId]/products/[productId]/status">) {
  const { shopId, productId } = await ctx.params;
  return respond(async () => productService.changeStatus(shopId, productId, await readJson(req)));
}

import { readJson, respond } from "@/features/products/http";
import { productService } from "@/features/products/server";

/** US-033 quick stock update: { stock }. */
export async function PUT(req: Request, ctx: RouteContext<"/api/shops/[shopId]/products/[productId]/variants/[variantId]/stock">) {
  const { shopId, productId, variantId } = await ctx.params;
  return respond(async () => productService.updateStock(shopId, productId, variantId, await readJson(req)));
}

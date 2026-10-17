import { requireShopRole } from "@/lib/auth";
import { notFound } from "@/features/products/errors";
import { readJson, respond } from "@/features/products/http";
import { getProduct } from "@/features/products/repo";
import { productService } from "@/features/products/server";

type Ctx = RouteContext<"/api/shops/[shopId]/products/[productId]">;

export async function GET(_req: Request, ctx: Ctx) {
  const { shopId, productId } = await ctx.params;
  return respond(async () => {
    const access = await requireShopRole(shopId, ["owner", "staff"]);
    const product = await getProduct(access.shopId, productId);
    if (!product) throw notFound();
    return { product };
  });
}

/** US-033: edit title, description, attributes and variants (matched by id). */
export async function PATCH(req: Request, ctx: Ctx) {
  const { shopId, productId } = await ctx.params;
  return respond(async () => productService.updateProduct(shopId, productId, await readJson(req)));
}

/** US-033: soft delete. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { shopId, productId } = await ctx.params;
  return respond(async () => productService.deleteProduct(shopId, productId));
}

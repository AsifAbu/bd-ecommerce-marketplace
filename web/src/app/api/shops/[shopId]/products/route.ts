import { requireShopRole } from "@/lib/auth";
import { readJson, respond } from "@/features/products/http";
import { listProducts } from "@/features/products/repo";
import { productService } from "@/features/products/server";

/** The shop's products (not deleted), newest change first. Owner or staff. */
export async function GET(_req: Request, ctx: RouteContext<"/api/shops/[shopId]/products">) {
  const { shopId } = await ctx.params;
  return respond(async () => {
    const access = await requireShopRole(shopId, ["owner", "staff"]);
    return { products: await listProducts(access.shopId) };
  });
}

/** US-030 / US-031: create a product. Body: { categoryId, title, description, attributes, variants }. */
export async function POST(req: Request, ctx: RouteContext<"/api/shops/[shopId]/products">) {
  const { shopId } = await ctx.params;
  return respond(async () => productService.createProduct(shopId, await readJson(req)), 201);
}

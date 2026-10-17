import { validationError } from "@/features/products/errors";
import { readJson, respond } from "@/features/products/http";
import { productService } from "@/features/products/server";

type Ctx = RouteContext<"/api/shops/[shopId]/products/[productId]/images/[imageId]">;

/** { cover: true } makes this image the cover. */
export async function PATCH(req: Request, ctx: Ctx) {
  const { shopId, productId, imageId } = await ctx.params;
  return respond(async () => {
    const body = (await readJson(req)) as { cover?: unknown } | null;
    if (body?.cover !== true) throw validationError({ cover: "Send { \"cover\": true }" });
    await productService.makeCover(shopId, productId, imageId);
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { shopId, productId, imageId } = await ctx.params;
  return respond(async () => productService.deleteImage(shopId, productId, imageId));
}

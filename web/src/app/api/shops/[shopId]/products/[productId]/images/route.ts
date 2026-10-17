import { formFile, readForm, respond } from "@/features/products/http";
import { productService } from "@/features/products/server";

/** US-032: multipart upload, field "file" (JPEG, PNG or WebP, at most 5 MB). */
export async function POST(req: Request, ctx: RouteContext<"/api/shops/[shopId]/products/[productId]/images">) {
  const { shopId, productId } = await ctx.params;
  return respond(async () => {
    const file = await formFile(await readForm(req), "file");
    const image = await productService.uploadImage(shopId, productId, file);
    return { id: image.id };
  }, 201);
}

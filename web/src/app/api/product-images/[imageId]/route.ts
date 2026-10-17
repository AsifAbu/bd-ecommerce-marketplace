import { connection } from "next/server";
import { respond } from "@/features/products/http";
import { productService } from "@/features/products/server";

/**
 * US-032: a product image (of a product that is not deleted) via a 302 to a short-lived signed
 * URL of the private bucket. 404 unknown, 503 when storage is down.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/product-images/[imageId]">) {
  await connection();
  const { imageId } = await ctx.params;
  return respond(async () => {
    const url = await productService.imageUrl(imageId);
    // The signed URL lives 5 minutes; let the browser reuse the redirect for 4.
    return new Response(null, { status: 302, headers: { location: url, "cache-control": "private, max-age=240" } });
  });
}

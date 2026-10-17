import type { NextRequest } from "next/server";
import { respond } from "@/features/products/http";
import { productService } from "@/features/products/server";

/** US-034: the CSV template for ?categoryId=<leaf>. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/shops/[shopId]/products/import/template">) {
  const { shopId } = await ctx.params;
  return respond(async () => {
    const { filename, csv } = await productService.importTemplate(shopId, req.nextUrl.searchParams.get("categoryId") ?? "");
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  });
}

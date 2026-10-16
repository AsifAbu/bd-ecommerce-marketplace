import { formFile, readForm, respond } from "@/features/products/http";
import { productService } from "@/features/products/server";

/**
 * US-034: multipart { categoryId, file } (CSV, at most 1 MB / 500 rows). All or nothing:
 * a 422 lists every problem as error.rows[{ row, column?, message }].
 */
export async function POST(req: Request, ctx: RouteContext<"/api/shops/[shopId]/products/import">) {
  const { shopId } = await ctx.params;
  return respond(async () => {
    const form = await readForm(req);
    const file = await formFile(form, "file");
    return productService.importCsv(shopId, form.get("categoryId"), file && { size: file.size, text: await file.text() });
  }, 201);
}

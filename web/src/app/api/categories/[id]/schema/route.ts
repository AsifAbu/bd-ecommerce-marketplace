import { schemaResponse } from "@/features/catalog/api";

/** Effective form definition of a leaf category. 404 unknown, 422 non-leaf or archived. */
export async function GET(_req: Request, ctx: RouteContext<"/api/categories/[id]/schema">) {
  const { id } = await ctx.params;
  return schemaResponse(id);
}

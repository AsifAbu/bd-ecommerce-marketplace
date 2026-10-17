import { connection } from "next/server";
import { searchErrorResponse } from "@/features/search/errors";
import { getVisibleCategoryTree } from "@/features/search/server";

/**
 * GET /api/categories?visible=true (US-040): the shopper category tree, only categories with at
 * least one live, in-stock product, each with its product count (leaf counts roll up). The full
 * tree is for admins (catalog pages), so this public endpoint always returns the visible tree.
 */
export async function GET() {
  await connection();
  try {
    return Response.json({ categories: await getVisibleCategoryTree() }, { headers: { "cache-control": "public, max-age=60" } });
  } catch (err) {
    return searchErrorResponse(err);
  }
}

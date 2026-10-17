import { searchErrorResponse } from "@/features/search/errors";
import { searchService } from "@/features/search/server";

/**
 * GET /api/search?q=&category=&f.<key>=&f.<key>.min=&price_min=&price_max=&shop=&sort=&page=
 * (US-041, US-042): `{ items, facets, total, page, perPage, totalPages, mode, category, params }`.
 * Same parameters as the /search page. 400 malformed parameters, 404 unknown category.
 */
export async function GET(req: Request) {
  try {
    const { engine, ...body } = await searchService.search(new URL(req.url).searchParams);
    return Response.json(body, { headers: { "cache-control": "public, max-age=30", "x-search-engine": engine } });
  } catch (err) {
    return searchErrorResponse(err);
  }
}

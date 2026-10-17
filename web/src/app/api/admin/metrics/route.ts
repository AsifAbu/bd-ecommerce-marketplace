import { connection, type NextRequest } from "next/server";
import { errorResponse } from "@/features/accounts/http";
import { adminDashboard } from "@/features/metrics/server";

/** US-083: GET /api/admin/metrics?days=7|30|90 (default 30). Platform Admin only: 401 guests, 403 others. */
export async function GET(req: NextRequest) {
  await connection();
  try {
    return Response.json(await adminDashboard(req.nextUrl.searchParams.get("days")));
  } catch (err) {
    return errorResponse(err);
  }
}

import { connection, type NextRequest } from "next/server";
import { errorResponse } from "@/features/accounts/http";
import { adminUsers } from "@/features/accounts/services";

/** GET /api/admin/users?q= : Platform Admin only (401 for guests, 403 for other users). */
export async function GET(req: NextRequest) {
  await connection();
  try {
    return Response.json({ users: await adminUsers.list(req.nextUrl.searchParams.get("q") ?? "") });
  } catch (err) {
    return errorResponse(err);
  }
}

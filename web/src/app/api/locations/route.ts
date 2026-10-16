import type { NextRequest } from "next/server";
import { DIVISIONS, districtsOf, upazilasOf } from "@/features/accounts/locations";

/**
 * Cascading address dropdowns.
 *   GET /api/locations                 -> { divisions }
 *   GET /api/locations?division=Dhaka  -> { districts }
 *   GET /api/locations?district=Dhaka  -> { upazilas }  (empty: the upazila is typed)
 */
export function GET(req: NextRequest) {
  const division = req.nextUrl.searchParams.get("division");
  const district = req.nextUrl.searchParams.get("district");
  if (district !== null) return Response.json({ upazilas: upazilasOf(district) });
  if (division !== null) return Response.json({ districts: districtsOf(division) });
  return Response.json({ divisions: DIVISIONS });
}

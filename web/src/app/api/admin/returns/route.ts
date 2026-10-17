import { connection } from "next/server";
import { returnsApi } from "@/features/returns/server";

/** Platform Admin: escalated return requests (or ?status=). */
export async function GET(req: Request) {
  await connection();
  return returnsApi.adminList(req);
}

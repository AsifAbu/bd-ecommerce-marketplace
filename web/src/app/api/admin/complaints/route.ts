import { connection } from "next/server";
import { complaintsApi } from "@/features/complaints/server";

/** Platform Admin queue: active complaints, overdue first, by due time (or ?status=). */
export async function GET(req: Request) {
  await connection();
  return complaintsApi.adminList(req);
}

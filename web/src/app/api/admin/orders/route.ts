import { connection } from "next/server";
import { lifecycleApi } from "@/features/orders/lifecycle/server";

/** US-053 (admin): every shop's orders, `?status=`, `?overdue=1`, `?shopId=`, with the 30-day handover rate. */
export async function GET(req: Request) {
  await connection();
  return lifecycleApi.listAdmin(req);
}

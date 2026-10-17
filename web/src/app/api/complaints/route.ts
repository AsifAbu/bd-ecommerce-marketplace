import { connection } from "next/server";
import { complaintsApi } from "@/features/complaints/server";

/** US-072: open a complaint about an order (customer, or a guest with the order open). */
export async function POST(req: Request) {
  await connection();
  return complaintsApi.create(req);
}

/** The user's complaints, or ?orderNo= those on one order this browser may open. */
export async function GET(req: Request) {
  await connection();
  return complaintsApi.list(req);
}

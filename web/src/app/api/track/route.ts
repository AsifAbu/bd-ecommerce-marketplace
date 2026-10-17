import { connection } from "next/server";
import { ordersApi } from "@/features/orders/server";

/** US-008: { orderNo } sends a code to the order's mobile; { orderNo, code } returns the order. */
export async function POST(req: Request) {
  await connection();
  return ordersApi.track(req);
}

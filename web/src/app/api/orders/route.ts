import { connection } from "next/server";
import { ordersApi } from "@/features/orders/server";

/** US-052: the logged-in customer's orders, newest first. */
export async function GET() {
  await connection();
  return ordersApi.listOrders();
}

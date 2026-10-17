import { connection } from "next/server";
import { ordersApi } from "@/features/orders/server";

/** US-051 / US-007: place a cash-on-delivery order from the cart (logged in or guest). See features/orders/api.ts. */
export async function POST(req: Request) {
  await connection();
  return ordersApi.checkout(req);
}

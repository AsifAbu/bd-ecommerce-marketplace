import { connection } from "next/server";
import { ordersApi } from "@/features/orders/server";

/** US-007 / US-051: { action: "send", phone } or { action: "verify", phone, code } for the checkout mobile. */
export async function POST(req: Request) {
  await connection();
  return ordersApi.checkoutOtp(req);
}

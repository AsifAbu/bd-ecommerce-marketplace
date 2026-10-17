import { connection } from "next/server";
import { cartApi } from "@/features/cart/server";

/** US-050/056/058: this user's or guest device's cart, grouped by shop with delivery charges. */
export async function GET(req: Request) {
  await connection();
  return cartApi.get(req);
}

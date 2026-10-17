import { cartApi } from "@/features/cart/server";

/** US-050: merge this device's guest cart into the logged-in user's cart (also done at login). */
export async function POST() {
  return cartApi.merge();
}

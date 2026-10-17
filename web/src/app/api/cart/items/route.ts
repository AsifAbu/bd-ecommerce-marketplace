import { cartApi } from "@/features/cart/server";

/** US-050: add { variantId, quantity? } to the cart (guests get a cart cookie). Capped at the stock. */
export async function POST(req: Request) {
  return cartApi.add(req);
}

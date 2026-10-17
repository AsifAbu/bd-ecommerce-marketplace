import { connection } from "next/server";
import { wishlistApi } from "@/features/wishlist/server";

/** US-057: the logged-in customer's wishlist, newest first, with price and stock. */
export async function GET() {
  await connection();
  return wishlistApi.list();
}

/** US-057: save { productId, variantId? }. 201 when added, 200 when it was already saved. */
export async function POST(req: Request) {
  return wishlistApi.add(req);
}

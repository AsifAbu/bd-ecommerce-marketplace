import { reviewsApi } from "@/features/reviews/server";

/** US-055: the logged-in buyer reviews a delivered order item { orderItemId, rating, title?, text? }. */
export async function POST(req: Request) {
  return reviewsApi.create(req);
}

import { payoutsApi } from "@/features/payouts/server";

/** US-082 (admin): { shopOrderId } records a delivered shop order's cash collection by hand. */
export async function POST(req: Request) {
  return payoutsApi.recordCollection(req);
}

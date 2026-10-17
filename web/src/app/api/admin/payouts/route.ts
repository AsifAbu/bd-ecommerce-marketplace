import { connection } from "next/server";
import { payoutsApi } from "@/features/payouts/server";

/** US-082 (admin): collections due per shop, pending and recent payouts. */
export async function GET() {
  await connection();
  return payoutsApi.adminOverview();
}

/** US-082 (admin): { shopId } batches the shop's unpaid collections into a pending payout. */
export async function POST(req: Request) {
  return payoutsApi.createBatch(req);
}

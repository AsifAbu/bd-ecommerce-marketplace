import { payoutsApi } from "@/features/payouts/server";

/** US-082 (admin): { reason } voids a pending payout; its collections are free for the next batch. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/payouts/[payoutId]/cancel">) {
  const { payoutId } = await ctx.params;
  return payoutsApi.cancel(req, payoutId);
}

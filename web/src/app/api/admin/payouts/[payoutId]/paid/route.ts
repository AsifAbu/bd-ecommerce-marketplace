import { payoutsApi } from "@/features/payouts/server";

/** US-082 (admin): { method, reference } marks a pending payout paid. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/payouts/[payoutId]/paid">) {
  const { payoutId } = await ctx.params;
  return payoutsApi.markPaid(req, payoutId);
}

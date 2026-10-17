import { lifecycleApi } from "@/features/orders/lifecycle/server";

/** US-053 (admin): any transition the lifecycle allows, e.g. { action: "deliver" } while there is no courier feed. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/orders/[shopOrderId]/status">) {
  const { shopOrderId } = await ctx.params;
  return lifecycleApi.transitionAdmin(req, shopOrderId);
}

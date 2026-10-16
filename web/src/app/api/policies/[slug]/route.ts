import { connection } from "next/server";
import { isPolicySlug } from "@/features/policies/client";
import { errorResponse, PolicyError } from "@/features/policies/errors";
import { policyService } from "@/features/policies/server";

/** GET /api/policies/:slug : the current version (public). 404 for an unknown or unpublished policy. */
export async function GET(_req: Request, ctx: RouteContext<"/api/policies/[slug]">) {
  await connection();
  try {
    const { slug } = await ctx.params;
    if (!isPolicySlug(slug)) throw new PolicyError(404, "NOT_FOUND", "Policy not found");
    const v = await policyService.getCurrentPolicy(slug);
    if (!v) throw new PolicyError(404, "NOT_FOUND", "This policy is not published yet");
    return Response.json({
      policy: { slug: v.slug, version: v.version, title: v.title, body: v.body, effectiveAt: v.effectiveAt },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

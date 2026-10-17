import { connection } from "next/server";
import { z } from "zod";
import { isPolicySlug } from "@/features/policies/client";
import { errorResponse, PolicyError } from "@/features/policies/errors";
import { policyService, requestMeta } from "@/features/policies/server";
import { requireUser } from "@/lib/auth";

const bodySchema = z.object({ version: z.number().int().positive().optional() }).optional();

/**
 * POST /api/policies/:slug/accept { version? } : the logged-in user accepts the current version.
 * 401 guest, 404 unknown policy, 409 if `version` is no longer current or nothing is published.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/policies/[slug]/accept">) {
  await connection();
  try {
    const user = await requireUser();
    const { slug } = await ctx.params;
    if (!isPolicySlug(slug)) throw new PolicyError(404, "NOT_FOUND", "Policy not found");
    const parsed = bodySchema.safeParse(await req.json().catch(() => undefined));
    if (!parsed.success) throw new PolicyError(422, "VALIDATION", "Body must be { version?: number }");
    const accepted = await policyService.recordAcceptance({
      userId: user.id,
      slugs: [slug],
      context: "account",
      shownVersions: parsed.data?.version ? { [slug]: parsed.data.version } : undefined,
      ...(await requestMeta()),
    });
    return Response.json({ accepted: accepted.map((p) => ({ slug: p.slug, version: p.version })) }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

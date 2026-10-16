import { headers } from "next/headers";
import { prismaPolicyRepo } from "./repo";
import { createPolicyService } from "./service";

/** The policy service backed by Prisma. Server-only. */
export const policyService = createPolicyService(prismaPolicyRepo);

/** IP and user agent of the current request, stored with an acceptance as evidence. */
export async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent"),
  };
}

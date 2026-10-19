import { prisma } from "@/lib/db";

/**
 * Which of these shops (by slug) are Verified sellers. Search documents carry no seller tier,
 * so result pages ask once per page, only for the shops that appear on it.
 */
export async function verifiedShopSlugs(slugs: string[]): Promise<Set<string>> {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return new Set();
  const rows = await prisma.shop.findMany({ where: { slug: { in: unique }, tier: "verified", status: "approved" }, select: { slug: true } });
  return new Set(rows.map((r) => r.slug));
}

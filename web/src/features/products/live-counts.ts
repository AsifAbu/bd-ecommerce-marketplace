import { dhakaToday } from "@/features/shops";
import { prisma } from "@/lib/db";
import { recountCategory } from "./repo";

/**
 * Daily job `products.refresh-counts`: recounts Category.liveProductCount for every leaf.
 * Product writes recount their own leaf, but liveness also changes with time (expiry dates)
 * and with shop status (approval, suspension, medicine licence), so this job catches up daily.
 */
export async function refreshLiveCounts(now: Date): Promise<{ categories: number }> {
  const today = dhakaToday(now);
  const leaves = await prisma.category.findMany({ where: { isLeaf: true }, select: { id: true } });
  for (const { id } of leaves) {
    await prisma.$transaction((tx) => recountCategory(tx, id, today));
  }
  return { categories: leaves.length };
}

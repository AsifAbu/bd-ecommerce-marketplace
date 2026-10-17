import { ScoreBadge } from "@/features/metrics";
import { storedShopScore } from "@/features/metrics/server";

/**
 * The seller performance score in the storefront header (US-059; UC-48 "View shop performance
 * score" extends "View shop storefront"). Reads the stored score by `shopId`; "New seller" when
 * the shop has too few delivered orders for one.
 */
export async function ShopScoreSlot({ shopId }: { shopId: string }) {
  return <ScoreBadge score={await storedShopScore(shopId)} />;
}

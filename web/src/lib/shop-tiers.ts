import type { ShopTier } from "@/generated/prisma/client";

/**
 * Seller tier limits (plan: "Seller tiers"). Stored here as config; the orders and
 * products features enforce them. null = no limit.
 */
export interface TierLimits {
  maxOpenOrders: number | null;
  maxLiveListings: number | null;
}

export const TIER_LIMITS: Record<ShopTier, TierLimits> = {
  basic: { maxOpenOrders: 20, maxLiveListings: 100 },
  verified: { maxOpenOrders: null, maxLiveListings: null },
};

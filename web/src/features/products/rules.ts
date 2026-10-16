import type { LicenceStatus, ShopStatus, ShopTier, ShopType } from "@/generated/prisma/client";
import { isLicenceValid } from "@/features/shops";
import { TIER_LIMITS } from "@/lib/shop-tiers";
import { ProductError } from "./errors";

/** Who may list where (US-030, US-015/016) and how many live listings a tier allows. */

export interface ListingShop {
  id: string;
  status: ShopStatus;
  type: ShopType;
  tier: ShopTier;
  medicineSuspended: boolean;
  licences: { status: LicenceStatus; expiryDate: Date }[];
}

export interface ListingCategory {
  name: string;
  requiresLicence: boolean;
}

/** The shop must be approved. Licence-only (medicine) categories need a medicine shop with a valid, verified licence. */
export function assertCanList(shop: ListingShop, category: ListingCategory, now: Date): void {
  if (shop.status !== "approved") {
    throw new ProductError(409, "SHOP_NOT_APPROVED", "Your shop must be approved before it can list products");
  }
  if (!category.requiresLicence) return;
  if (shop.type !== "medicine") {
    throw new ProductError(
      403,
      "LICENCE_REQUIRED",
      `Only medicine shops with a verified drug licence can list in ${category.name}`,
      { categoryId: "Your shop can't list in this category" },
    );
  }
  if (shop.medicineSuspended || !shop.licences.some((l) => isLicenceValid(l, now))) {
    throw new ProductError(
      403,
      "LICENCE_REQUIRED",
      `Your drug licence must be verified and not expired before you can list in ${category.name}`,
    );
  }
}

/** Basic shops: at most N live listings. `adding` = listings about to go live. */
export function assertWithinTierLimit(tier: ShopTier, liveCount: number, adding = 1): void {
  const max = TIER_LIMITS[tier].maxLiveListings;
  if (max === null || liveCount + adding <= max) return;
  const left = Math.max(0, max - liveCount);
  throw new ProductError(
    409,
    "TIER_LIMIT",
    `Basic shops can have at most ${max} live listings (you have ${liveCount}${adding > 1 ? `, room for ${left} more` : ""}). ` +
      "Deactivate a listing or upgrade to Verified seller.",
  );
}

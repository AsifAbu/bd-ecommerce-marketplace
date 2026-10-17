import type { Prisma, ProductStatus, ShopStatus } from "@/generated/prisma/client";

/**
 * "Live" = visible to customers: active, not deleted, not expired (no expiry, or expiring today
 * or later in Bangladesh), the shop approved, and not a licence-only (medicine) listing of a shop
 * whose medicine selling is suspended. One definition for queries (search, counts, tier limits)
 * and one for a single row (seller list labels); keep them in step.
 */
export function liveProductWhere(today: Date): Prisma.ProductWhereInput {
  return {
    status: "active",
    deletedAt: null,
    shop: { status: "approved" },
    AND: [
      { OR: [{ expiresOn: null }, { expiresOn: { gte: today } }] },
      { OR: [{ category: { requiresLicence: false } }, { shop: { medicineSuspended: false } }] },
    ],
  };
}

export interface LiveCheck {
  status: ProductStatus;
  deletedAt: Date | null;
  expiresOn: Date | null;
  shop: { status: ShopStatus; medicineSuspended: boolean };
  category: { requiresLicence: boolean };
}

export type ListingState = "live" | "inactive" | "deleted" | "expired" | "shop_not_approved" | "medicine_suspended";

export const LISTING_STATE_LABELS: Record<ListingState, string> = {
  live: "Active",
  inactive: "Inactive",
  deleted: "Deleted",
  expired: "Expired (hidden)",
  shop_not_approved: "Hidden: shop not approved",
  medicine_suspended: "Hidden: medicine selling suspended",
};

/** Why a listing is or is not live (the first reason wins). */
export function listingState(p: LiveCheck, today: Date): ListingState {
  if (p.deletedAt) return "deleted";
  if (p.status !== "active") return "inactive";
  if (p.expiresOn && p.expiresOn < today) return "expired";
  if (p.shop.status !== "approved") return "shop_not_approved";
  if (p.category.requiresLicence && p.shop.medicineSuspended) return "medicine_suspended";
  return "live";
}

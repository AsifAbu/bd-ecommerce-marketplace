import type { ShopStatus, ShopTier } from "@/generated/prisma/client";
import { Badge, statusTone } from "@/components/ui";

const STATUS_TEXT: Record<ShopStatus, string> = {
  pending: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};

/** The shop's approval status as a badge (jade approved, amber pending, vermilion rejected or suspended). */
export function ShopStatusBadge({ status }: { status: ShopStatus }) {
  return <Badge tone={statusTone(status)}>{STATUS_TEXT[status]}</Badge>;
}

export const shopStatusText = (status: ShopStatus) => STATUS_TEXT[status];

/** Basic or Verified seller. */
export function TierBadge({ tier }: { tier: ShopTier }) {
  return <Badge tone={tier === "verified" ? "brand" : "neutral"}>{tier === "verified" ? "Verified seller" : "Basic seller"}</Badge>;
}

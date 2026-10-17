/**
 * Slot for the seller performance score in the storefront header (US-059, R1 stretch goal).
 * Renders nothing until that story lands; it then reads the shop's score by `shopId` and shows
 * it here (UC-48 "View shop performance score" extends "View shop storefront").
 */
export function ShopScoreSlot({ shopId }: { shopId: string }) {
  void shopId;
  return null;
}

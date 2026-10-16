import { AppError } from "@/lib/errors";
import type { LicenceStatus, ShopStatus, ShopTier, ShopType, UpgradeStatus } from "@/generated/prisma/client";

/** A business-rule violation (409). Actions map it to the standard error shape. */
export class ShopRuleError extends AppError {
  constructor(message: string) {
    super(409, "CONFLICT", message);
    this.name = "ShopRuleError";
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000; // Asia/Dhaka is UTC+6, no DST
export const EXPIRY_WARNING_DAYS = 30;

/** Today's date in Bangladesh, as UTC midnight (matches how @db.Date values are read back). */
export function dhakaToday(now: Date): Date {
  const local = new Date(now.getTime() + DHAKA_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

interface LicenceLike {
  status: LicenceStatus;
  expiryDate: Date;
}

/** Verified and not past its expiry date (valid through the expiry day). */
export function isLicenceValid(licence: LicenceLike, now: Date): boolean {
  return licence.status === "verified" && licence.expiryDate >= dhakaToday(now);
}

interface ShopLike {
  status: ShopStatus;
  type: ShopType;
  tier: ShopTier;
  upgradeStatus: UpgradeStatus;
}

/** US-011 / US-015: approve a pending shop or reinstate a suspended one. Medicine needs a valid licence. */
export function assertCanApproveShop(shop: ShopLike, licences: LicenceLike[], now: Date): void {
  if (shop.status !== "pending" && shop.status !== "suspended") {
    throw new ShopRuleError(`A ${shop.status} shop can't be approved`);
  }
  if (shop.type === "medicine" && !licences.some((l) => isLicenceValid(l, now))) {
    throw new ShopRuleError("Verify the medicine licence before approving this shop");
  }
}

export function assertCanRejectShop(shop: ShopLike): void {
  if (shop.status !== "pending") throw new ShopRuleError("Only a pending shop can be rejected");
}

export function assertCanSuspendShop(shop: ShopLike): void {
  if (shop.status !== "approved") throw new ShopRuleError("Only an approved shop can be suspended");
}

/** US-017: a Basic shop asks to become Verified. */
export function assertCanRequestUpgrade(shop: ShopLike): void {
  if (shop.tier === "verified") throw new ShopRuleError("This shop is already Verified");
  if (shop.upgradeStatus === "pending") throw new ShopRuleError("An upgrade request is already waiting for review");
  if (shop.status === "rejected") throw new ShopRuleError("A rejected shop can't be upgraded");
}

export function assertCanReviewUpgrade(shop: ShopLike): void {
  if (shop.upgradeStatus !== "pending") throw new ShopRuleError("There is no upgrade request to review");
}

export function assertCanReviewLicence(licence: LicenceLike): void {
  if (licence.status !== "pending") throw new ShopRuleError(`A ${licence.status} licence can't be reviewed`);
}

/** US-015: owner uploads a (new) certificate, e.g. after a rejection or before expiry. */
export function assertCanUploadLicence(shop: ShopLike, licences: LicenceLike[]): void {
  if (shop.type !== "medicine") throw new ShopRuleError("Only medicine shops upload a drug licence");
  if (licences.some((l) => l.status === "pending")) {
    throw new ShopRuleError("A licence is already waiting for review");
  }
}

export interface ExpiryCandidate {
  id: string;
  shopId: string;
  status: LicenceStatus;
  expiryDate: Date;
  warnedAt: Date | null;
}

/**
 * US-016 daily job. Verified licences past their expiry date expire; a shop left with no valid
 * licence has its medicine selling suspended. Licences expiring within 30 days get one warning,
 * unless the shop already has a renewed licence with a later expiry.
 */
export function classifyLicences<T extends ExpiryCandidate>(licences: T[], now: Date) {
  const today = dhakaToday(now).getTime();
  const warnBefore = today + EXPIRY_WARNING_DAYS * DAY_MS;
  const verified = licences.filter((l) => l.status === "verified");
  const latest = new Map<string, number>();
  for (const l of verified) latest.set(l.shopId, Math.max(latest.get(l.shopId) ?? 0, l.expiryDate.getTime()));

  const toExpire = verified.filter((l) => l.expiryDate.getTime() < today);
  const toWarn = verified.filter((l) => {
    const t = l.expiryDate.getTime();
    return t >= today && t <= warnBefore && !l.warnedAt && t === latest.get(l.shopId);
  });
  const shopsToSuspend = [...new Set(toExpire.map((l) => l.shopId))].filter((id) => latest.get(id)! < today);
  return { toExpire, toWarn, shopsToSuspend };
}

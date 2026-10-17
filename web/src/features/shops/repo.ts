import type { Prisma, RegistrationType, ShopType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { assertInviteEmailMatches } from "./rules";

/**
 * Shops data access (ADR-004). Shop-side functions take the guard-checked `shopId` first and
 * always filter by it. User-side functions take `userId` first. `admin*` functions are
 * unscoped and may only be called after requirePlatformAdmin().
 */

function audit(actorId: string | null, action: string, entity: string, entityId: string, data?: Prisma.InputJsonValue) {
  return prisma.auditLog.create({ data: { actorId, action, entity, entityId, data } });
}

// ---- Shop-scoped ----------------------------------------------------------

export function getShop(shopId: string) {
  return prisma.shop.findFirst({ where: { id: shopId } });
}

export function listLicences(shopId: string) {
  return prisma.shopLicence.findMany({ where: { shopId }, orderBy: { createdAt: "desc" } });
}

export function listMembers(shopId: string) {
  return prisma.shopMember.findMany({
    where: { shopId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export function listPendingInvites(shopId: string) {
  return prisma.shopInvite.findMany({ where: { shopId, acceptedAt: null }, orderBy: { createdAt: "desc" } });
}

export interface ProfileInput {
  logoUrl?: string;
  bannerUrl?: string;
  description?: string;
  policies?: string;
}

export async function updateProfile(shopId: string, data: ProfileInput, actorId: string) {
  const values = {
    logoUrl: data.logoUrl ?? null,
    bannerUrl: data.bannerUrl ?? null,
    description: data.description ?? null,
    policies: data.policies ?? null,
  };
  await prisma.$transaction([
    prisma.shop.updateMany({ where: { id: shopId }, data: values }),
    audit(actorId, "shop.profile_updated", "shop", shopId),
  ]);
}

export async function requestUpgrade(
  shopId: string,
  data: { registrationType: RegistrationType; registrationNo: string; registrationDocKey: string },
  actorId: string,
) {
  await prisma.$transaction([
    prisma.shop.updateMany({
      where: { id: shopId, tier: "basic" },
      data: { ...data, upgradeStatus: "pending", upgradeReason: null },
    }),
    audit(actorId, "shop.upgrade_requested", "shop", shopId, { registrationType: data.registrationType }),
  ]);
}

export async function addLicence(
  shopId: string,
  data: { licenceNo: string; expiryDate: Date; documentKey: string },
  actorId: string,
) {
  await prisma.$transaction([
    prisma.shopLicence.create({ data: { ...data, shopId } }),
    audit(actorId, "licence.uploaded", "shop", shopId, { licenceNo: data.licenceNo }),
  ]);
}

export async function createInvite(
  shopId: string,
  data: { email: string; tokenHash: string; expiresAt: Date },
  actorId: string,
) {
  await prisma.$transaction([
    prisma.shopInvite.create({ data: { ...data, shopId, invitedById: actorId } }),
    audit(actorId, "shop.staff_invited", "shop", shopId, { email: data.email }),
  ]);
}

/** Removes a staff member of this shop. Owners can't be removed. Returns false if nothing matched. */
export async function removeStaff(shopId: string, memberId: string, actorId: string): Promise<boolean> {
  const [result] = await prisma.$transaction([
    prisma.shopMember.deleteMany({ where: { id: memberId, shopId, role: "staff" } }),
    audit(actorId, "shop.staff_removed", "shop", shopId, { memberId }),
  ]);
  return result.count > 0;
}

// ---- User-scoped ----------------------------------------------------------

export function listMyShops(userId: string) {
  return prisma.shopMember.findMany({
    where: { userId },
    include: { shop: { select: { id: true, name: true, slug: true, status: true, tier: true, type: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function isSlugTaken(slug: string) {
  return (await prisma.shop.count({ where: { slug } })) > 0;
}

export interface ApplicationInput {
  name: string;
  slug: string;
  type: ShopType;
  ownerNid: string;
  ownerPhotoKey: string;
  licence?: { licenceNo: string; expiryDate: Date; documentKey: string };
}

/** US-010: creates a pending Basic shop with the applicant as owner (and the licence for medicine). */
export async function createShopApplication(userId: string, data: ApplicationInput) {
  const { licence, ...shop } = data;
  return prisma.$transaction(async (tx) => {
    const created = await tx.shop.create({
      data: {
        ...shop,
        ownerId: userId,
        members: { create: { userId, role: "owner" } },
        ...(licence ? { licences: { create: licence } } : {}),
      },
    });
    await tx.auditLog.create({
      data: { actorId: userId, action: "shop.applied", entity: "shop", entityId: created.id, data: { type: shop.type } },
    });
    return created;
  });
}

export function findInviteByTokenHash(tokenHash: string) {
  return prisma.shopInvite.findUnique({ where: { tokenHash }, include: { shop: { select: { name: true } } } });
}

/** The user's own email and whether it is verified (for invite acceptance). */
export function getAccountEmail(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true } });
}

/**
 * Adds the user as staff and marks the invite used. The account email is checked again inside
 * the transaction (verified and equal to the invite email), so a caller can't skip the check.
 */
export async function acceptInvite(userId: string, invite: { id: string; shopId: string; email: string }) {
  await prisma.$transaction(async (tx) => {
    const account = await tx.user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true } });
    assertInviteEmailMatches(invite.email, account);
    const used = await tx.shopInvite.updateMany({
      where: { id: invite.id, acceptedAt: null },
      data: { acceptedAt: new Date() },
    });
    if (used.count === 0) return;
    await tx.shopMember.upsert({
      where: { shopId_userId: { shopId: invite.shopId, userId } },
      create: { shopId: invite.shopId, userId, role: "staff" },
      update: {},
    });
    await tx.auditLog.create({
      data: { actorId: userId, action: "shop.staff_joined", entity: "shop", entityId: invite.shopId },
    });
  });
}

// ---- Platform Admin (unscoped) --------------------------------------------

export function adminGetShop(shopId: string) {
  return prisma.shop.findUnique({ where: { id: shopId }, include: { licences: true } });
}

export function adminGetLicence(licenceId: string) {
  return prisma.shopLicence.findUnique({ where: { id: licenceId }, include: { shop: true } });
}

export async function adminListQueue() {
  const [pendingShops, upgrades, licences, approvedShops] = await Promise.all([
    prisma.shop.findMany({
      where: { status: "pending" },
      include: { owner: { select: { name: true, email: true, phone: true } }, licences: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.shop.findMany({ where: { upgradeStatus: "pending" }, orderBy: { updatedAt: "asc" } }),
    prisma.shopLicence.findMany({
      where: { status: "pending" },
      include: { shop: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.shop.findMany({ where: { status: { in: ["approved", "suspended"] } }, orderBy: { name: "asc" } }),
  ]);
  return { pendingShops, upgrades, licences, approvedShops };
}

/** Admin change to a shop, written to the audit log in the same transaction. */
export async function adminUpdateShop(
  shopId: string,
  data: Prisma.ShopUpdateInput,
  actorId: string,
  action: string,
  auditData?: Prisma.InputJsonValue,
) {
  await prisma.$transaction([
    prisma.shop.update({ where: { id: shopId }, data }),
    audit(actorId, action, "shop", shopId, auditData),
  ]);
}

/** Admin licence review. A verified licence lifts a lapsed-licence medicine suspension. */
export async function adminReviewLicence(
  licence: { id: string; shopId: string },
  decision: { status: "verified" } | { status: "rejected"; reason: string },
  actorId: string,
) {
  const reason = decision.status === "rejected" ? decision.reason : null;
  await prisma.$transaction([
    prisma.shopLicence.update({
      where: { id: licence.id },
      data: { status: decision.status, reason, reviewedById: actorId, reviewedAt: new Date() },
    }),
    ...(decision.status === "verified"
      ? [prisma.shop.update({ where: { id: licence.shopId }, data: { medicineSuspended: false } })]
      : []),
    audit(actorId, `licence.${decision.status}`, "shop_licence", licence.id, { shopId: licence.shopId, reason }),
  ]);
}

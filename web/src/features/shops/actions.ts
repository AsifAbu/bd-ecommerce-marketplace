"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin, requireShopRole, requireUser } from "@/lib/auth";
import { isTestMode } from "@/lib/config";
import { getStorage } from "@/lib/storage";
import { formString, parseForm, runAction, ValidationError, type ActionResult } from "./action-result";
import { sendMail } from "@/lib/mail";
import * as repo from "./repo";
import {
  assertCanApproveShop,
  assertCanRejectShop,
  assertCanRequestUpgrade,
  assertCanReviewLicence,
  assertCanReviewUpgrade,
  assertCanSuspendShop,
  assertCanUploadLicence,
  assertInviteEmailMatches,
  assertInviteUsable,
  ShopRuleError,
} from "./rules";
import {
  applicationSchema,
  inviteSchema,
  licenceSchema,
  profileSchema,
  reasonSchema,
  upgradeSchema,
  type SchemaContext,
} from "./schemas";

/*
 * Every action checks the caller first (requireUser / requireShopRole / requirePlatformAdmin);
 * ids from the form are only used after that check. Hidden fields are never trusted.
 */

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ctx = (): SchemaContext => ({ testMode: isTestMode(), now: new Date() });
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function storeFile(kind: string, file: File): Promise<string> {
  const ext = file.name.match(/\.[a-z0-9]{1,8}$/i)?.[0].toLowerCase() ?? "";
  const key = `shops/${kind}/${randomUUID()}${ext}`;
  await getStorage().putObject(key, new Uint8Array(await file.arrayBuffer()), file.type);
  return key;
}

async function loadShop(shopId: string) {
  const shop = await repo.getShop(shopId);
  if (!shop) throw new ShopRuleError("Shop not found");
  return shop;
}

// ---- Applicant / owner -----------------------------------------------------

/** US-010 / US-015: apply to open a shop. Starts as a pending Basic shop. */
export async function applyForShop(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let shopId = "";
  const result = await runAction(async () => {
    const user = await requireUser();
    const data = parseForm(applicationSchema(ctx()), formData);
    if (await repo.isSlugTaken(data.slug)) throw new ValidationError({ slug: "This shop link is taken" });

    const ownerPhotoKey = await storeFile("owner-photo", data.ownerPhoto);
    const licence =
      data.type === "medicine" && data.licenceFile && data.licenceNo && data.licenceExpiry
        ? {
            licenceNo: data.licenceNo,
            expiryDate: data.licenceExpiry,
            documentKey: await storeFile("licence", data.licenceFile),
          }
        : undefined;

    const shop = await repo.createShopApplication(user.id, {
      name: data.name,
      slug: data.slug,
      type: data.type,
      ownerNid: data.ownerNid,
      ownerPhotoKey,
      licence,
    });
    shopId = shop.id;
    return "Application sent";
  });
  if (shopId) redirect(`/seller/${shopId}`);
  return result;
}

/** US-017: owner asks to upgrade from Basic to Verified. */
export async function requestUpgrade(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { shopId, user } = await requireShopRole(formString(formData, "shopId"), ["owner"]);
    assertCanRequestUpgrade(await loadShop(shopId));
    const data = parseForm(upgradeSchema(ctx()), formData);
    const registrationDocKey = await storeFile("registration", data.registrationDoc);
    await repo.requestUpgrade(
      shopId,
      { registrationType: data.registrationType, registrationNo: data.registrationNo, registrationDocKey },
      user.id,
    );
    refresh();
    return "Upgrade request sent for review";
  });
}

/** US-015: owner uploads a (new) drug licence certificate. */
export async function uploadLicence(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { shopId, user } = await requireShopRole(formString(formData, "shopId"), ["owner"]);
    assertCanUploadLicence(await loadShop(shopId), await repo.listLicences(shopId));
    const data = parseForm(licenceSchema(ctx()), formData);
    const documentKey = await storeFile("licence", data.licenceFile);
    await repo.addLicence(shopId, { licenceNo: data.licenceNo, expiryDate: data.licenceExpiry, documentKey }, user.id);
    refresh();
    return "Licence sent for verification";
  });
}

/** US-012: owner edits the shop profile. */
export async function updateProfile(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { shopId, user } = await requireShopRole(formString(formData, "shopId"), ["owner"]);
    await repo.updateProfile(shopId, parseForm(profileSchema, formData), user.id);
    refresh();
    return "Profile saved";
  });
}

/** US-013: owner invites a staff member by email (link sent through the mail catcher in test mode). */
export async function inviteStaff(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { shopId, user } = await requireShopRole(formString(formData, "shopId"), ["owner"]);
    const { email } = parseForm(inviteSchema, formData);
    const shop = await loadShop(shopId);
    const token = randomBytes(32).toString("base64url");
    await repo.createInvite(
      shopId,
      { email, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
      user.id,
    );
    const link = `${process.env.AUTH_URL ?? "http://localhost:3000"}/seller/invite/${token}`;
    await sendMail({
      to: [email],
      subject: `You are invited to help run ${shop.name}`,
      text: `${user.name ?? "The shop owner"} invited you to join ${shop.name} as staff.\n\nOpen this link and log in with ${email} to accept (valid for 7 days):\n${link}`,
    });
    refresh();
    return `Invite sent to ${email}`;
  });
}

/** US-013: owner removes a staff member. */
export async function removeStaff(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { shopId, user } = await requireShopRole(formString(formData, "shopId"), ["owner"]);
    const removed = await repo.removeStaff(shopId, formString(formData, "memberId"), user.id);
    if (!removed) throw new ShopRuleError("Staff member not found");
    refresh();
    return "Staff member removed";
  });
}

/** US-013: the invited user accepts. The logged-in account's email must match the invite and be verified. */
export async function acceptInvite(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let shopId = "";
  const result = await runAction(async () => {
    const user = await requireUser();
    const invite = await repo.findInviteByTokenHash(hashToken(formString(formData, "token")));
    assertInviteUsable(invite, new Date());
    assertInviteEmailMatches(invite.email, await repo.getAccountEmail(user.id));
    await repo.acceptInvite(user.id, invite);
    shopId = invite.shopId;
    return "Invite accepted";
  });
  if (shopId) redirect(`/seller/${shopId}`);
  return result;
}

// ---- Platform Admin (US-011, US-016, US-017) -------------------------------

export async function approveShop(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    const shop = await repo.adminGetShop(formString(formData, "shopId"));
    if (!shop) throw new ShopRuleError("Shop not found");
    assertCanApproveShop(shop, shop.licences, new Date());
    await repo.adminUpdateShop(shop.id, { status: "approved", statusReason: null }, admin.id, "shop.approved", {
      from: shop.status,
    });
    refresh();
    return `${shop.name} approved`;
  });
}

export async function rejectShop(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    const shop = await repo.adminGetShop(formString(formData, "shopId"));
    if (!shop) throw new ShopRuleError("Shop not found");
    assertCanRejectShop(shop);
    const { reason } = parseForm(reasonSchema, formData);
    await repo.adminUpdateShop(shop.id, { status: "rejected", statusReason: reason }, admin.id, "shop.rejected", {
      reason,
    });
    refresh();
    return `${shop.name} rejected`;
  });
}

export async function suspendShop(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    const shop = await repo.adminGetShop(formString(formData, "shopId"));
    if (!shop) throw new ShopRuleError("Shop not found");
    assertCanSuspendShop(shop);
    const { reason } = parseForm(reasonSchema, formData);
    await repo.adminUpdateShop(shop.id, { status: "suspended", statusReason: reason }, admin.id, "shop.suspended", {
      reason,
    });
    refresh();
    return `${shop.name} suspended`;
  });
}

export async function approveUpgrade(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    const shop = await repo.adminGetShop(formString(formData, "shopId"));
    if (!shop) throw new ShopRuleError("Shop not found");
    assertCanReviewUpgrade(shop);
    await repo.adminUpdateShop(
      shop.id,
      { tier: "verified", upgradeStatus: "approved", upgradeReason: null },
      admin.id,
      "shop.upgrade_approved",
    );
    refresh();
    return `${shop.name} is now Verified`;
  });
}

export async function rejectUpgrade(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    const shop = await repo.adminGetShop(formString(formData, "shopId"));
    if (!shop) throw new ShopRuleError("Shop not found");
    assertCanReviewUpgrade(shop);
    const { reason } = parseForm(reasonSchema, formData);
    await repo.adminUpdateShop(
      shop.id,
      { upgradeStatus: "rejected", upgradeReason: reason },
      admin.id,
      "shop.upgrade_rejected",
      { reason },
    );
    refresh();
    return `Upgrade for ${shop.name} rejected`;
  });
}

export async function verifyLicence(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    const licence = await repo.adminGetLicence(formString(formData, "licenceId"));
    if (!licence) throw new ShopRuleError("Licence not found");
    assertCanReviewLicence(licence);
    await repo.adminReviewLicence(licence, { status: "verified" }, admin.id);
    refresh();
    return `Licence ${licence.licenceNo} verified`;
  });
}

export async function rejectLicence(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    const licence = await repo.adminGetLicence(formString(formData, "licenceId"));
    if (!licence) throw new ShopRuleError("Licence not found");
    assertCanReviewLicence(licence);
    const { reason } = parseForm(reasonSchema, formData);
    await repo.adminReviewLicence(licence, { status: "rejected", reason }, admin.id);
    refresh();
    return `Licence ${licence.licenceNo} rejected`;
  });
}

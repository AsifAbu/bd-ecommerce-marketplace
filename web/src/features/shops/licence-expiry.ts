import { prisma } from "@/lib/db";
import { sendMail, type Mail } from "@/lib/mail";
import { classifyLicences, type ExpiryCandidate } from "./rules";

/** US-016 daily job ("shops.licence-expiry"): warn 30 days before expiry, expire lapsed licences. */
export interface ExpiryLicence extends ExpiryCandidate {
  licenceNo: string;
  shop: { name: string; owner: { email: string | null } };
}

export interface ExpiryDeps {
  findVerifiedLicences: () => Promise<ExpiryLicence[]>;
  findAdminEmails: () => Promise<string[]>;
  /** In one transaction: expires the shop's lapsed licences and, if `suspend`, suspends its medicine selling. */
  expireShop: (shopId: string, licences: ExpiryLicence[], suspend: boolean) => Promise<void>;
  markWarned: (licence: ExpiryLicence, at: Date) => Promise<void>;
  notify: (mail: Mail) => Promise<void>;
}

export async function runLicenceExpiryCheck(now: Date, deps: ExpiryDeps) {
  const { toExpire, toWarn, shopsToSuspend } = classifyLicences(await deps.findVerifiedLicences(), now);
  const result = { expired: toExpire.length, suspended: shopsToSuspend.length, warned: toWarn.length };
  if (toExpire.length === 0 && toWarn.length === 0) return result;

  const admins = await deps.findAdminEmails();
  const recipients = (l: ExpiryLicence) => [...(l.shop.owner.email ? [l.shop.owner.email] : []), ...admins];
  const date = (d: Date) => d.toISOString().slice(0, 10);

  // Database work first, mail afterwards: a failed email must never leave an expired shop unsuspended.
  const mails: Mail[] = [];
  for (const shopId of new Set(toExpire.map((l) => l.shopId))) {
    const licences = toExpire.filter((l) => l.shopId === shopId);
    const suspend = shopsToSuspend.includes(shopId);
    await deps.expireShop(shopId, licences, suspend);
    if (!suspend) continue;
    const l = licences[0];
    mails.push({
      to: recipients(l),
      subject: `Medicine licence expired: ${l.shop.name}`,
      text: `The drug licence ${l.licenceNo} of ${l.shop.name} expired on ${date(l.expiryDate)}.\nMedicine selling is suspended until a new certificate is uploaded and verified.`,
    });
  }
  for (const l of toWarn) {
    await deps.markWarned(l, now);
    mails.push({
      to: recipients(l),
      subject: `Medicine licence expires soon: ${l.shop.name}`,
      text: `The drug licence ${l.licenceNo} of ${l.shop.name} expires on ${date(l.expiryDate)}.\nUpload a renewed certificate before then to keep selling medicine.`,
    });
  }
  for (const mail of mails) {
    try {
      await deps.notify(mail);
    } catch (err) {
      console.error(`licence-expiry: failed to send "${mail.subject}"`, err);
    }
  }
  return result;
}

export const prismaExpiryDeps: ExpiryDeps = {
  findVerifiedLicences: () =>
    prisma.shopLicence.findMany({
      where: { status: "verified" },
      include: { shop: { select: { name: true, owner: { select: { email: true } } } } },
    }),
  findAdminEmails: async () =>
    (await prisma.user.findMany({ where: { isPlatformAdmin: true, status: "active" }, select: { email: true } }))
      .map((u) => u.email)
      .filter((e): e is string => !!e),
  expireShop: async (shopId, licences, suspend) => {
    await prisma.$transaction([
      prisma.shopLicence.updateMany({
        where: { id: { in: licences.map((l) => l.id) }, status: "verified" },
        data: { status: "expired" },
      }),
      ...licences.map((l) =>
        prisma.auditLog.create({ data: { action: "licence.expired", entity: "shop_licence", entityId: l.id, data: { shopId } } }),
      ),
      ...(suspend
        ? [
            prisma.shop.update({ where: { id: shopId }, data: { medicineSuspended: true } }),
            prisma.auditLog.create({ data: { action: "shop.medicine_suspended", entity: "shop", entityId: shopId } }),
          ]
        : []),
    ]);
  },
  markWarned: async (l, at) => {
    await prisma.$transaction([
      prisma.shopLicence.update({ where: { id: l.id }, data: { warnedAt: at } }),
      prisma.auditLog.create({
        data: { action: "licence.expiry_warned", entity: "shop_licence", entityId: l.id, data: { shopId: l.shopId } },
      }),
    ]);
  },
  notify: sendMail,
};

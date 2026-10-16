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
  expire: (licence: ExpiryLicence) => Promise<void>;
  /** Suspends the shop's medicine selling until a new licence is verified. */
  suspendMedicine: (shopId: string) => Promise<void>;
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

  for (const l of toExpire) await deps.expire(l);
  for (const shopId of shopsToSuspend) {
    await deps.suspendMedicine(shopId);
    const l = toExpire.find((x) => x.shopId === shopId)!;
    await deps.notify({
      to: recipients(l),
      subject: `Medicine licence expired: ${l.shop.name}`,
      text: `The drug licence ${l.licenceNo} of ${l.shop.name} expired on ${date(l.expiryDate)}.\nMedicine selling is suspended until a new certificate is uploaded and verified.`,
    });
  }
  for (const l of toWarn) {
    await deps.markWarned(l, now);
    await deps.notify({
      to: recipients(l),
      subject: `Medicine licence expires soon: ${l.shop.name}`,
      text: `The drug licence ${l.licenceNo} of ${l.shop.name} expires on ${date(l.expiryDate)}.\nUpload a renewed certificate before then to keep selling medicine.`,
    });
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
  expire: async (l) => {
    await prisma.$transaction([
      prisma.shopLicence.updateMany({ where: { id: l.id, status: "verified" }, data: { status: "expired" } }),
      prisma.auditLog.create({
        data: { action: "licence.expired", entity: "shop_licence", entityId: l.id, data: { shopId: l.shopId } },
      }),
    ]);
  },
  suspendMedicine: async (shopId) => {
    await prisma.$transaction([
      prisma.shop.update({ where: { id: shopId }, data: { medicineSuspended: true } }),
      prisma.auditLog.create({ data: { action: "shop.medicine_suspended", entity: "shop", entityId: shopId } }),
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

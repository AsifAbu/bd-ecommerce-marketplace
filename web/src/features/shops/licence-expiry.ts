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

/** A step that failed for one licence or shop ("suspend" ids are shop ids, "admins" has no id). */
export interface ExpiryFailure {
  step: "suspend" | "expire" | "warn" | "admins" | "notify";
  id: string;
  error: string;
}

export interface ExpiryResult {
  /** Counts of state changes that were saved. */
  expired: number;
  suspended: number;
  warned: number;
  /** Emails sent. */
  notified: number;
  failures: ExpiryFailure[];
}

/** State-change failures (as opposed to email failures): the job should be retried. */
export const hasStateFailures = (result: ExpiryResult) => result.failures.some((f) => f.step !== "notify" && f.step !== "admins");

/**
 * Two phases, so a failed email can never leave a lapsed shop selling medicine:
 *  1. State changes, each on its own (one failure does not stop the others):
 *     suspend shops first, then expire licences. A licence whose shop could not be suspended stays
 *     "verified", so the next run picks it up and tries the suspension again.
 *  2. Emails, only for changes that were saved. A failed email is logged and reported, not retried.
 */
export async function runLicenceExpiryCheck(
  now: Date,
  deps: ExpiryDeps,
  logError: (message: string, err: unknown) => void = console.error,
): Promise<ExpiryResult> {
  const { toExpire, toWarn, shopsToSuspend } = classifyLicences(await deps.findVerifiedLicences(), now);
  const result: ExpiryResult = { expired: 0, suspended: 0, warned: 0, notified: 0, failures: [] };
  if (toExpire.length === 0 && toWarn.length === 0) return result;

  const attempt = async (step: ExpiryFailure["step"], id: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      return true;
    } catch (err) {
      result.failures.push({ step, id, error: err instanceof Error ? err.message : String(err) });
      logError(`[shops.licence-expiry] ${step} failed${id ? ` for ${id}` : ""}`, err);
      return false;
    }
  };

  // Phase 1: state changes.
  const suspended: string[] = [];
  for (const shopId of shopsToSuspend) {
    if (await attempt("suspend", shopId, () => deps.suspendMedicine(shopId))) suspended.push(shopId);
  }
  const notSuspended = new Set(shopsToSuspend.filter((id) => !suspended.includes(id)));
  for (const l of toExpire) {
    if (notSuspended.has(l.shopId)) continue; // retried next run, together with the suspension
    if (await attempt("expire", l.id, () => deps.expire(l))) result.expired++;
  }
  result.suspended = suspended.length;
  const warned: ExpiryLicence[] = [];
  for (const l of toWarn) {
    if (await attempt("warn", l.id, () => deps.markWarned(l, now))) warned.push(l);
  }
  result.warned = warned.length;

  // Phase 2: emails.
  let admins: string[] = [];
  await attempt("admins", "", async () => {
    admins = await deps.findAdminEmails();
  });
  const recipients = (l: ExpiryLicence) => [...(l.shop.owner.email ? [l.shop.owner.email] : []), ...admins];
  const date = (d: Date) => d.toISOString().slice(0, 10);
  const send = async (l: ExpiryLicence, subject: string, text: string) => {
    const to = recipients(l);
    if (to.length === 0) return;
    if (await attempt("notify", l.id, () => deps.notify({ to, subject, text }))) result.notified++;
  };

  for (const shopId of suspended) {
    const l = toExpire.find((x) => x.shopId === shopId)!;
    await send(
      l,
      `Medicine licence expired: ${l.shop.name}`,
      `The drug licence ${l.licenceNo} of ${l.shop.name} expired on ${date(l.expiryDate)}.\nMedicine selling is suspended until a new certificate is uploaded and verified.`,
    );
  }
  for (const l of warned) {
    await send(
      l,
      `Medicine licence expires soon: ${l.shop.name}`,
      `The drug licence ${l.licenceNo} of ${l.shop.name} expires on ${date(l.expiryDate)}.\nUpload a renewed certificate before then to keep selling medicine.`,
    );
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

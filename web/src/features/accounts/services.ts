import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { createOtpProvider } from "@/lib/otp";
import { requirePlatformAdmin } from "@/lib/auth";
import { recordAcceptance, requestMeta, SIGNUP_POLICY_SLUGS } from "@/features/policies";
import { addressRepoFor } from "./address-repo";
import { createAdminUsers } from "./admin-users";
import { appUrl, sendMail } from "@/lib/mail";
import { createOtpService, type OtpPurpose } from "./otp-service";
import type { SignUpDeps } from "./signup";
import { createTokenService, type TokenType } from "./tokens";

/** Prisma-backed wiring for the accounts feature (server only). */

export const otpService = createOtpService({
  provider: createOtpProvider(),
  secret: process.env.AUTH_SECRET ?? "",
  store: {
    async create(data) {
      await prisma.otpCode.create({ data });
    },
    latest: (phone: string, purpose: OtpPurpose) =>
      prisma.otpCode.findFirst({ where: { phone, purpose }, orderBy: { createdAt: "desc" } }),
    countSince: (by, since) => prisma.otpCode.count({ where: { ...by, createdAt: { gte: since } } }),
    async incrementAttempts(id) {
      const row = await prisma.otpCode.update({ where: { id }, data: { attempts: { increment: 1 } } });
      return row.attempts;
    },
    async consume(id, at) {
      await prisma.otpCode.update({ where: { id }, data: { consumedAt: at } });
    },
  },
});

export const tokenService = createTokenService({
  async create(data) {
    await prisma.accountToken.create({ data });
  },
  findByHash: (tokenHash) => prisma.accountToken.findUnique({ where: { tokenHash } }),
  async markUsed(id, at) {
    const { count } = await prisma.accountToken.updateMany({ where: { id, usedAt: null }, data: { usedAt: at } });
    return count === 1;
  },
});

export const addressRepo = addressRepoFor(prisma);

export const signUpDeps: SignUpDeps = {
  identifierTaken: async (kind, value) =>
    (await prisma.user.count({ where: kind === "email" ? { email: value } : { phone: value } })) > 0,
  createUser: (data) => prisma.user.create({ data, select: { id: true } }),
  async recordConsent(userId) {
    try {
      await recordAcceptance({ userId, slugs: SIGNUP_POLICY_SLUGS, context: "signup", ...(await requestMeta()) });
    } catch (err) {
      // The account exists already; a missing policy version must not break sign-up. Logged for the admin.
      console.error("[accounts] could not record sign-up policy acceptance", err);
    }
  },
};

export const adminUsers = createAdminUsers({
  requirePlatformAdmin,
  searchUsers: (q, limit) =>
    prisma.user.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, name: true, email: true, phone: true, isPlatformAdmin: true, status: true, createdAt: true },
    }),
  async updateUserWithAudit(userId, change, audit) {
    if (!(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) return false;
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: change }),
      prisma.auditLog.create({ data: { ...audit, data: audit.data as object, entity: "user", entityId: userId } }),
    ]);
    return true;
  },
});

/** Emails a single-use link (email verification or password reset). */
export async function sendTokenEmail(user: { id: string; email: string }, type: TokenType) {
  const token = await tokenService.issue(user.id, type, user.email);
  if (type === "email_verify") {
    const link = appUrl(`/api/account/verify-email?token=${token}`);
    await sendMail({ to: [user.email], subject: "Verify your email", text: `Open this link within 24 hours to verify your email:\n\n${link}\n` });
  } else {
    const link = appUrl(`/reset-password?token=${token}`);
    await sendMail({
      to: [user.email],
      subject: "Reset your password",
      text: `Open this link within 1 hour to choose a new password:\n\n${link}\n\nIf you did not ask for this, ignore this email.`,
    });
  }
}

/** Client IP for rate limits (first X-Forwarded-For hop set by the host's proxy). */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

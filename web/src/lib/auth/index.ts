import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createGuards } from "./guards-core";

export { ForbiddenError, UnauthorizedError } from "./errors";
export type { GuardUser } from "./guards-core";

/**
 * Server-side role checks for server components, server actions and route handlers.
 *   const user = await requireUser();          // 401 if not logged in / suspended
 *   const admin = await requirePlatformAdmin(); // 403 if not a Platform Admin
 * Shop roles (requireShopMember(shopId, role)) are added by the shops feature.
 */
export const { requireUser, requirePlatformAdmin } = createGuards({
  getSessionUserId: async () => (await auth())?.user?.id,
  findUserById: (id) =>
    prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, phone: true, name: true, isPlatformAdmin: true, status: true },
    }),
});

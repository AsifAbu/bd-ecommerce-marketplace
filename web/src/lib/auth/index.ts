import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createGuards } from "./guards-core";
import { createShopGuard } from "./shop-guard-core";

export { ForbiddenError, UnauthorizedError } from "./errors";
export type { GuardUser } from "./guards-core";
export type { ShopAccess } from "./shop-guard-core";

/**
 * Server-side role checks for server components, server actions and route handlers.
 *   const user = await requireUser();          // 401 if not logged in / suspended
 *   const admin = await requirePlatformAdmin(); // 403 if not a Platform Admin
 *   const { shopId } = await requireShopRole(id, ["owner"]); // 403 if not owner of that shop
 */
export const { requireUser, requirePlatformAdmin } = createGuards({
  getSessionUserId: async () => (await auth())?.user?.id,
  findUserById: (id) =>
    prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, phone: true, name: true, isPlatformAdmin: true, status: true },
    }),
});

/** Shop-scoped role check (shops feature). See shop-guard-core.ts. */
export const requireShopRole = createShopGuard({
  requireUser,
  findShopRole: async (shopId, userId) =>
    (
      await prisma.shopMember.findUnique({
        where: { shopId_userId: { shopId, userId } },
        select: { role: true },
      })
    )?.role ?? null,
});

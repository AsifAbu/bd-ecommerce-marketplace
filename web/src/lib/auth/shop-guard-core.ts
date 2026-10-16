import type { ShopRole } from "@/generated/prisma/client";
import { ForbiddenError } from "./errors";
import type { GuardUser } from "./guards-core";

export interface ShopGuardDeps {
  requireUser: () => Promise<GuardUser>;
  findShopRole: (shopId: string, userId: string) => Promise<ShopRole | null>;
}

export interface ShopAccess {
  user: GuardUser;
  shopId: string;
  role: ShopRole;
}

/**
 * Shop-scoped role check (ADR-004). Throws 401 for guests, 403 when the user is not a
 * member of this shop with one of `roles`. A missing shop and someone else's shop give the
 * same 403, so shop ids can't be probed. Pass the returned `shopId` to the repositories.
 */
export function createShopGuard(deps: ShopGuardDeps) {
  return async function requireShopRole(shopId: string, roles: readonly ShopRole[]): Promise<ShopAccess> {
    const user = await deps.requireUser();
    const role = shopId ? await deps.findShopRole(shopId, user.id) : null;
    if (!role || !roles.includes(role)) throw new ForbiddenError("Not allowed for this shop");
    return { user, shopId, role };
  };
}

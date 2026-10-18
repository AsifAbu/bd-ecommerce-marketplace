import { prisma } from "@/lib/db";

/**
 * Read-only data for the header account menu: who is logged in, which shops they belong to and,
 * for a Platform Admin, how many things are waiting for review. Kept in lib/ because the header is
 * shared UI that needs a little data from several features.
 */
export interface MenuShop {
  id: string;
  name: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  role: "owner" | "staff";
}

export interface AdminCounts {
  /** Shops waiting for approval. */
  pendingShops: number;
  /** Basic shops that asked to become Verified. */
  pendingUpgrades: number;
  /** Medicine licences waiting for verification. */
  pendingLicences: number;
}

export interface MenuData {
  displayName: string;
  isPlatformAdmin: boolean;
  shops: MenuShop[];
  admin: AdminCounts | null;
}

export async function loadMenuData(userId: string): Promise<MenuData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true, isPlatformAdmin: true },
  });
  if (!user) return null;

  const memberships = await prisma.shopMember.findMany({
    where: { userId },
    select: { role: true, shop: { select: { id: true, name: true, status: true } } },
    orderBy: { createdAt: "asc" },
  });

  let admin: AdminCounts | null = null;
  if (user.isPlatformAdmin) {
    const [pendingShops, pendingUpgrades, pendingLicences] = await Promise.all([
      prisma.shop.count({ where: { status: "pending" } }),
      prisma.shop.count({ where: { upgradeStatus: "pending" } }),
      prisma.shopLicence.count({ where: { status: "pending" } }),
    ]);
    admin = { pendingShops, pendingUpgrades, pendingLicences };
  }

  return {
    displayName: user.name?.trim() || user.email || user.phone || "My account",
    isPlatformAdmin: user.isPlatformAdmin,
    shops: memberships.map((m) => ({ id: m.shop.id, name: m.shop.name, status: m.shop.status, role: m.role })),
    admin,
  };
}

/** Total of the admin's waiting items, shown as a badge on the menu button. */
export const adminWaiting = (c: AdminCounts) => c.pendingShops + c.pendingUpgrades + c.pendingLicences;

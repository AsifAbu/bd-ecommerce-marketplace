import type { Prisma } from "@/generated/prisma/client";
import { liveProductWhere } from "@/features/products";
import { prisma } from "@/lib/db";
import { ownerWhere } from "./owner";
import type { CartOwner, ItemChanges, NewItem } from "./service";

/**
 * Cart data access (ADR-004 style). Every function takes the owner first and filters by it: a
 * user's rows by userId, a guest device's rows by its hashed token (and no user), so one
 * customer or device can never read or change another's cart.
 */

export { ownerWhere };

function ownerData(owner: CartOwner) {
  return owner.kind === "user" ? { userId: owner.userId, guestToken: null } : { userId: null, guestToken: owner.guestToken };
}

const itemInclude = {
  variant: { select: { id: true, price: true, stock: true, options: true } },
  product: {
    select: {
      id: true,
      title: true,
      categoryId: true,
      attributes: true,
      status: true,
      deletedAt: true,
      expiresOn: true,
      category: { select: { requiresLicence: true } },
      shop: {
        select: { id: true, name: true, slug: true, status: true, medicineSuspended: true, freeDeliveryThreshold: true },
      },
      images: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], take: 1, select: { id: true } },
    },
  },
} satisfies Prisma.CartItemInclude;

export function listItems(owner: CartOwner) {
  return prisma.cartItem.findMany({ where: ownerWhere(owner), include: itemInclude, orderBy: { createdAt: "asc" } });
}

export function getItem(owner: CartOwner, itemId: string) {
  return prisma.cartItem.findFirst({ where: { ...ownerWhere(owner), id: itemId }, include: itemInclude });
}

export function findByVariant(owner: CartOwner, variantId: string) {
  return prisma.cartItem.findFirst({ where: { ...ownerWhere(owner), variantId } });
}

export function countLines(owner: CartOwner) {
  return prisma.cartItem.count({ where: ownerWhere(owner) });
}

export async function sumQuantity(owner: CartOwner): Promise<number> {
  const rows = await prisma.cartItem.findMany({
    where: { ...ownerWhere(owner), savedForLater: false },
    select: { quantity: true },
  });
  return rows.reduce((n, r) => n + r.quantity, 0);
}

export function createItem(owner: CartOwner, data: NewItem) {
  return prisma.cartItem.create({ data: { ...data, savedForLater: data.savedForLater ?? false, ...ownerData(owner) } });
}

/** False when the row isn't the owner's. */
export async function updateItem(owner: CartOwner, itemId: string, data: ItemChanges): Promise<boolean> {
  const { count } = await prisma.cartItem.updateMany({ where: { ...ownerWhere(owner), id: itemId }, data });
  return count > 0;
}

export async function deleteItem(owner: CartOwner, itemId: string): Promise<boolean> {
  const { count } = await prisma.cartItem.deleteMany({ where: { ...ownerWhere(owner), id: itemId } });
  return count > 0;
}

export async function deleteItems(owner: CartOwner, itemIds: string[]): Promise<number> {
  const { count } = await prisma.cartItem.deleteMany({ where: { ...ownerWhere(owner), id: { in: itemIds } } });
  return count;
}

/** Login merge: one of this guest's rows becomes the user's. */
export async function reassignToUser(guestToken: string, itemId: string, userId: string): Promise<boolean> {
  const { count } = await prisma.cartItem.updateMany({
    where: { id: itemId, guestToken, userId: null },
    data: { userId, guestToken: null },
  });
  return count > 0;
}

/** A variant of a live listing (public data). */
export function findLiveVariant(variantId: string, today: Date) {
  return prisma.productVariant.findFirst({
    where: { id: variantId, product: liveProductWhere(today) },
    select: { id: true, productId: true, shopId: true, price: true, stock: true },
  });
}

/** The user's default address (for the delivery zone). Scoped by userId. */
export function findDefaultAddress(userId: string) {
  return prisma.address.findFirst({
    where: { userId, isDefault: true },
    select: { division: true, district: true },
  });
}

/**
 * Removes whole guest carts with no row changed since `olderThan` (each add renews the cookie
 * for as long, so their cookie has expired). A cart with one recent row is kept entirely.
 */
export function purgeGuestCarts(olderThan: Date): Promise<number> {
  return prisma.$executeRaw`
    DELETE FROM cart_item c
    WHERE c.user_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM cart_item r
        WHERE r.guest_token = c.guest_token AND r.user_id IS NULL AND r.updated_at >= ${olderThan}
      )`;
}

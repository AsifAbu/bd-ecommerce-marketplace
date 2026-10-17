import type { Prisma } from "@/generated/prisma/client";
import type { CartOwner } from "./service";

/**
 * The rows of one cart owner: a user's rows by userId, a guest device's rows by its hashed token
 * (and no user). Used by the cart repository and, through the public entry, by checkout (US-051)
 * to remove the ordered lines inside the order transaction.
 */
export function ownerWhere(owner: CartOwner): Prisma.CartItemWhereInput {
  return owner.kind === "user" ? { userId: owner.userId } : { guestToken: owner.guestToken, userId: null };
}

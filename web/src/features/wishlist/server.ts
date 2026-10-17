import { getCategorySchema } from "@/features/catalog";
import { requireUser, UnauthorizedError, type GuardUser } from "@/lib/auth";
import { createWishlistApi } from "./api";
import * as repo from "./repo";
import { createWishlistService } from "./service";

/**
 * The wishlist wired to the session and database. Pages, route handlers and (Sprint 6) the
 * cart use these; callers pass the user id from requireUser().
 */
export const wishlistService = createWishlistService({ repo, getCategorySchema, now: () => new Date() });

export const wishlistApi = createWishlistApi({ requireUser, service: wishlistService });

/** The logged-in, active user, or null for a guest (pages that also serve guests). */
export async function currentUserOrNull(): Promise<GuardUser | null> {
  try {
    return await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) return null;
    throw err;
  }
}

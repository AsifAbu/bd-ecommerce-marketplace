import type { User } from "@/generated/prisma/client";
import { ForbiddenError, UnauthorizedError } from "./errors";

export type GuardUser = Pick<User, "id" | "email" | "emailVerifiedAt" | "phone" | "name" | "isPlatformAdmin" | "status">;

export interface GuardDeps {
  getSessionUserId: () => Promise<string | null | undefined>;
  findUserById: (id: string) => Promise<GuardUser | null>;
}

/**
 * Role checks with injected dependencies (unit-testable).
 * The user is re-read from the database on every check, so a suspension or a
 * removed admin flag takes effect immediately, not when the JWT expires.
 */
export function createGuards(deps: GuardDeps) {
  async function requireUser(): Promise<GuardUser> {
    const userId = await deps.getSessionUserId();
    if (!userId) throw new UnauthorizedError();
    const user = await deps.findUserById(userId);
    if (!user || user.status !== "active") throw new UnauthorizedError();
    return user;
  }

  async function requirePlatformAdmin(): Promise<GuardUser> {
    const user = await requireUser();
    if (!user.isPlatformAdmin) throw new ForbiddenError("Platform Admin only");
    return user;
  }

  return { requireUser, requirePlatformAdmin };
}

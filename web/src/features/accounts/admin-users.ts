import type { GuardUser } from "@/lib/auth/guards-core";
import { ForbiddenError } from "@/lib/auth/errors";

export interface AdminUserRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  isPlatformAdmin: boolean;
  status: "active" | "suspended";
  createdAt: Date;
}

export type UserChange = { status: "active" | "suspended" } | { isPlatformAdmin: boolean };

export interface AdminUsersDeps {
  requirePlatformAdmin(): Promise<GuardUser>;
  searchUsers(query: string, limit: number): Promise<AdminUserRow[]>;
  /** Applies the change and writes the audit entry in one transaction. Returns false if the user does not exist. */
  updateUserWithAudit(
    userId: string,
    change: UserChange,
    audit: { actorId: string; action: string; data: Record<string, unknown> },
  ): Promise<boolean>;
}

export const USER_ACTIONS = {
  suspend: { change: { status: "suspended" }, audit: "user.suspended" },
  reactivate: { change: { status: "active" }, audit: "user.reactivated" },
  grantAdmin: { change: { isPlatformAdmin: true }, audit: "user.admin_granted" },
  revokeAdmin: { change: { isPlatformAdmin: false }, audit: "user.admin_revoked" },
} as const satisfies Record<string, { change: UserChange; audit: string }>;

export type UserAction = keyof typeof USER_ACTIONS;

/** Platform Admin user management (US-004). Every call checks the role first; every change is audited. */
export function createAdminUsers(deps: AdminUsersDeps) {
  async function list(query: string) {
    await deps.requirePlatformAdmin();
    return deps.searchUsers(query.trim().slice(0, 100), 50);
  }

  async function apply(userId: string, action: UserAction): Promise<boolean> {
    const admin = await deps.requirePlatformAdmin();
    if (userId === admin.id) throw new ForbiddenError("You cannot change your own account here");
    const { change, audit } = USER_ACTIONS[action];
    return deps.updateUserWithAudit(userId, change, { actorId: admin.id, action: audit, data: { ...change } });
  }

  return { list, apply };
}

import { z } from "zod";
import type { User } from "@/generated/prisma/client";
import { parseLoginIdentifier } from "./identifier";
import { verifyPassword } from "./password";

export const credentialsSchema = z.object({
  identifier: z.string().min(3).max(254),
  password: z.string().min(1).max(200),
});

export type FindUserByIdentifier = (
  kind: "email" | "phone",
  value: string,
) => Promise<Pick<User, "id" | "email" | "phone" | "name" | "passwordHash" | "status"> | null>;

/** Lockout: this many failures for one identifier (or one IP) within the window blocks further tries. */
export const LOGIN_LIMITS = { windowMs: 15 * 60_000, perIdentifier: 5, perIp: 20 };

export interface LoginLimiter {
  recentFailures: (identifier: string, ip: string | null, since: Date) => Promise<{ byIdentifier: number; byIp: number }>;
  recordFailure: (identifier: string, ip: string | null) => Promise<void>;
  clearFailures: (identifier: string) => Promise<void>;
}

/**
 * Checks mobile-or-email + password. Returns the session user, null, or "locked" after too many failures.
 * Kept free of Next/Auth.js imports so it can be unit tested.
 */
export async function authorizeCredentials(
  raw: unknown,
  findUser: FindUserByIdentifier,
  limiter: LoginLimiter,
  ip: string | null,
  now = new Date(),
) {
  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) return null;

  const identifier = parseLoginIdentifier(parsed.data.identifier);
  if (!identifier) return null;

  const since = new Date(now.getTime() - LOGIN_LIMITS.windowMs);
  const failures = await limiter.recentFailures(identifier.value, ip, since);
  if (failures.byIdentifier >= LOGIN_LIMITS.perIdentifier || (ip && failures.byIp >= LOGIN_LIMITS.perIp)) {
    return "locked" as const;
  }

  const user = await findUser(identifier.kind, identifier.value);
  if (!user || user.status !== "active" || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    await limiter.recordFailure(identifier.value, ip);
    return null;
  }

  await limiter.clearFailures(identifier.value);
  return { id: user.id, name: user.name, email: user.email };
}

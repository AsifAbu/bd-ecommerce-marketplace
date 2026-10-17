import { z } from "zod";
import type { User } from "@/generated/prisma/client";
import { parseLoginIdentifier } from "./identifier";
import { loginKey, type LoginThrottle } from "./login-throttle";
import { hashPassword, verifyPassword } from "./password";

export const credentialsSchema = z.object({
  identifier: z.string().min(3).max(254),
  password: z.string().min(1).max(200),
});

export type FindUserByIdentifier = (
  kind: "email" | "phone",
  value: string,
) => Promise<Pick<User, "id" | "email" | "phone" | "name" | "passwordHash" | "status"> | null>;

export interface AuthorizeOptions {
  /** Login lockout; every failed attempt (unknown user, suspended, wrong password) counts. */
  throttle?: LoginThrottle;
  ip?: string | null;
}

// Compared against when there is no user, so unknown and known identifiers take about as long.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword("not-a-real-password"));

/**
 * Checks mobile-or-email + password. Returns the session user or null.
 * Every failure returns null (the same generic error), including a locked identifier, so the
 * result never tells whether an account exists. Kept free of Next/Auth.js imports for unit tests.
 */
export async function authorizeCredentials(raw: unknown, findUser: FindUserByIdentifier, options: AuthorizeOptions = {}) {
  const { throttle, ip = null } = options;
  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) return null;

  const identifier = parseLoginIdentifier(parsed.data.identifier);
  if (!identifier) return null;

  const key = loginKey(identifier);
  if (throttle && !(await throttle.check(key, ip)).allowed) return null;

  const user = await findUser(identifier.kind, identifier.value);
  const passwordOk = await verifyPassword(parsed.data.password, user ? user.passwordHash : await getDummyHash());
  if (!user || user.status !== "active" || !passwordOk) {
    await throttle?.recordFailure(key, ip);
    return null;
  }

  await throttle?.recordSuccess(key);
  return { id: user.id, name: user.name, email: user.email };
}

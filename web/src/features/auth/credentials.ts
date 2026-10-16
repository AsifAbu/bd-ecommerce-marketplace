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

/**
 * Checks mobile-or-email + password. Returns the session user or null.
 * Kept free of Next/Auth.js imports so it can be unit tested.
 */
export async function authorizeCredentials(raw: unknown, findUser: FindUserByIdentifier) {
  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) return null;

  const identifier = parseLoginIdentifier(parsed.data.identifier);
  if (!identifier) return null;

  const user = await findUser(identifier.kind, identifier.value);
  if (!user || user.status !== "active") return null;

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return null;

  return { id: user.id, name: user.name, email: user.email };
}

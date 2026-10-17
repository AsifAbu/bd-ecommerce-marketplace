/**
 * US-009: earlier guest orders join an account only through a VERIFIED identifier (D12):
 * the account's verified mobile (OTP) or its verified email (link). A typed but unverified email
 * or phone never attaches anything, so typing someone's email at checkout never shows them the
 * order and never shows that person's orders to the typist. Runs at login and sign-up (Auth.js
 * signIn event) and right after a phone OTP or email link verifies an identifier.
 */

export interface LinkingDeps {
  findUser: (userId: string) => Promise<{
    id: string;
    phone: string | null;
    phoneVerifiedAt: Date | null;
    email: string | null;
    emailVerifiedAt: Date | null;
    status: string;
  } | null>;
  attach: (userId: string, by: { contactPhone: string } | { contactEmail: string }, via: "phone" | "email", at: Date) => Promise<number>;
  now: () => Date;
}

export async function linkGuestOrders(userId: string, deps: LinkingDeps): Promise<{ byPhone: number; byEmail: number }> {
  const user = await deps.findUser(userId);
  const result = { byPhone: 0, byEmail: 0 };
  if (!user || user.status !== "active") return result;
  const at = deps.now();
  if (user.phone && user.phoneVerifiedAt) result.byPhone = await deps.attach(user.id, { contactPhone: user.phone }, "phone", at);
  if (user.email && user.emailVerifiedAt) result.byEmail = await deps.attach(user.id, { contactEmail: user.email.toLowerCase() }, "email", at);
  return result;
}

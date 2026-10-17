import { linkGuestOrdersFor } from "@/features/orders/server";
import { prisma } from "@/lib/db";
import { tokenService } from "./services";

/** Marks the email verified if the link is valid and the account still uses that email. */
export async function verifyEmailFromLink(token: string): Promise<boolean> {
  const res = await tokenService.consume(token, "email_verify");
  if (!res.ok) return false;
  const { count } = await prisma.user.updateMany({
    where: { id: res.token.userId, email: res.token.email },
    data: { emailVerifiedAt: new Date() },
  });
  // US-009: guest orders placed with this email join the account now that it is verified.
  if (count === 1) await linkGuestOrdersFor(res.token.userId);
  return count === 1;
}

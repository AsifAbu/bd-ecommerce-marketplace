import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { authorizeCredentials, type LoginLimiter } from "@/features/auth/credentials";

/** Thrown when the login lockout applies; loginAction shows its own message for this code. */
export class LoginLockedError extends CredentialsSignin {
  code = "locked";
}

// shortcut: old login_failure rows are never pruned, add a daily cleanup job when the table grows.
const loginLimiter: LoginLimiter = {
  recentFailures: async (identifier, ip, since) => {
    const [byIdentifier, byIp] = await Promise.all([
      prisma.loginFailure.count({ where: { identifier, createdAt: { gte: since } } }),
      ip ? prisma.loginFailure.count({ where: { ip, createdAt: { gte: since } } }) : 0,
    ]);
    return { byIdentifier, byIp };
  },
  recordFailure: async (identifier, ip) => {
    await prisma.loginFailure.create({ data: { identifier, ip } });
  },
  clearFailures: async (identifier) => {
    await prisma.loginFailure.deleteMany({ where: { identifier } });
  },
};

/**
 * Auth.js v5. Login with mobile number or email + password.
 * The credentials provider requires JWT sessions (httpOnly cookie).
 * Role and status are re-read from the database by the guards in src/lib/auth.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Mobile or email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
        const result = await authorizeCredentials(
          credentials,
          (kind, value) => prisma.user.findUnique({ where: kind === "email" ? { email: value } : { phone: value } }),
          loginLimiter,
          ip,
        );
        if (result === "locked") throw new LoginLockedError();
        return result;
      },
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

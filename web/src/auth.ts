import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { authorizeCredentials } from "@/features/auth/credentials";

/**
 * Auth.js v5. Login with mobile number or email + password.
 * The credentials provider requires JWT sessions (httpOnly cookie).
 * Role and status are re-read from the database by the guards in src/lib/auth.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Mobile or email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: (credentials) =>
        authorizeCredentials(credentials, (kind, value) =>
          prisma.user.findUnique({ where: kind === "email" ? { email: value } : { phone: value } }),
        ),
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

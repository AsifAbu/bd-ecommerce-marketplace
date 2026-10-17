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
  pages: { signIn: "/login" },
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
  events: {
    // US-050: the guest cart on this device merges into the account cart at login.
    // Imported lazily: the cart module imports the guards, which import this file.
    async signIn({ user }) {
      const { mergeGuestCartAtLogin } = await import("@/features/cart/login-merge");
      await mergeGuestCartAtLogin(user.id);
    },
  },
});

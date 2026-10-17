import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { ipFromHeaders } from "@/lib/client-ip";
import { authorizeCredentials } from "@/features/auth/credentials";
import { prismaLoginFailureStore } from "@/features/auth/login-failure-store";
import { createLoginThrottle } from "@/features/auth/login-throttle";

/** Login lockout: 5 failures per identifier in 15 min lock it for 15 min; per-IP cap (see login-throttle.ts). */
const loginThrottle = createLoginThrottle({ store: prismaLoginFailureStore });

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
      authorize: (credentials, request) =>
        authorizeCredentials(
          credentials,
          (kind, value) => prisma.user.findUnique({ where: kind === "email" ? { email: value } : { phone: value } }),
          // signIn() from a server action forwards the incoming request headers, so the IP is the client's.
          { throttle: loginThrottle, ip: ipFromHeaders(request.headers) },
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
    // US-009: guest orders placed with this account's verified mobile or email join the account.
    async signIn({ user }) {
      const { mergeGuestCartAtLogin } = await import("@/features/cart/login-merge");
      await mergeGuestCartAtLogin(user.id);
      const { linkGuestOrdersFor } = await import("@/features/orders/server");
      await linkGuestOrdersFor(user.id);
    },
  },
});

import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { ForbiddenError, UnauthorizedError, requirePlatformAdmin, requireUser } from "@/lib/auth";

/** Renders children only for the given role; otherwise a login or "not allowed" message. */
export async function RoleGate({ children, role }: { children: ReactNode; role: "admin" | "user" }) {
  await connection(); // session reads are request-time (Cache Components)
  try {
    await (role === "admin" ? requirePlatformAdmin() : requireUser());
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return (
        <p role="alert">
          Please{" "}
          <Link className="underline" href="/api/auth/signin">
            log in
          </Link>
          {role === "admin" ? " as a Platform Admin." : "."}
        </p>
      );
    }
    if (err instanceof ForbiddenError) return <p role="alert">This page is for the Platform Admin only.</p>;
    throw err;
  }
  return children;
}

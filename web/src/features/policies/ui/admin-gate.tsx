import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { Notice } from "@/components/ui";
import { ForbiddenError, requirePlatformAdmin, UnauthorizedError } from "@/lib/auth";

/** Platform Admin only: guests go to the login page, other users see a "not allowed" message. */
export async function AdminGate({ children, callbackUrl }: { children: ReactNode; callbackUrl: string }) {
  await connection(); // session reads are request-time (Cache Components)
  try {
    await requirePlatformAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    if (err instanceof ForbiddenError) {
      return (
        <Notice tone="danger" role="alert">
          This page is for the Platform Admin only.
        </Notice>
      );
    }
    throw err;
  }
  return children;
}

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requirePlatformAdmin, requireUser, UnauthorizedError } from "@/lib/auth";

/** For pages: the logged-in user, or a redirect to the login page. */
export async function userOrLogin(returnTo: string) {
  await connection();
  try {
    return await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect(`/login?callbackUrl=${encodeURIComponent(returnTo)}`);
    throw err;
  }
}

/** For admin pages: guests go to login; logged-in non-admins get null (show "not allowed"). */
export async function adminOrLogin(returnTo: string) {
  await userOrLogin(returnTo);
  return requirePlatformAdmin().catch(() => null);
}

import { notFound, redirect } from "next/navigation";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth";

/** For pages: guests go to login, users without access get a 404 (hides other shops and admin pages). */
export async function guardPage<T>(callbackUrl: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }
}

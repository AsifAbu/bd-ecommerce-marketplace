import { NextResponse, type NextRequest } from "next/server";
import { verifyEmailFromLink } from "@/features/accounts/email-verification";

/** Email verification link target: marks the email verified, then opens the account page. */
export async function GET(req: NextRequest) {
  const ok = await verifyEmailFromLink(req.nextUrl.searchParams.get("token") ?? "");
  return NextResponse.redirect(new URL(ok ? "/account?emailVerified=1" : "/verify-email-failed", req.nextUrl));
}

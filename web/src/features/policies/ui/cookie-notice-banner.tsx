"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonStyles } from "@/components/ui";
import { dismissCookieNoticeAction } from "../actions";
import { COOKIE_POLICY_SLUG, policyPath } from "../catalog";

/**
 * The dismissible banner, in the page flow at the top (not fixed, so it never covers content).
 * Dismissing hides it at once and calls a server action that sets the cookie.
 */
export function CookieNoticeBanner({ version }: { version: number | null }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <section
      aria-label="Cookie notice"
      data-testid="cookie-notice"
      className="w-full bg-surface px-4 py-2 sm:px-6"
    >
      <form
        action={async (formData) => {
          setHidden(true);
          await dismissCookieNoticeAction(formData);
        }}
        className="mx-auto flex w-full max-w-[var(--container-page)] items-center justify-between gap-4 text-xs sm:text-sm"
      >
        <p>
          We use only the cookies needed to run this site, such as keeping you logged in. No advertising or tracking cookies.
          Read our{" "}
          <Link className="font-medium text-jade underline" href={policyPath(COOKIE_POLICY_SLUG)}>
            Cookie Policy
          </Link>
          .
        </p>
        <input type="hidden" name="version" value={version ?? 0} />
        <button type="submit" className={`${buttonStyles({ variant: "secondary", size: "sm" })} shrink-0`}>
          OK, got it
        </button>
      </form>
    </section>
  );
}

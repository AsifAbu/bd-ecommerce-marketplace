"use client";

import Link from "next/link";
import { useState } from "react";
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
      className="w-full border-b border-gray-300 bg-gray-50 px-4 py-3"
    >
      <form
        action={async (formData) => {
          setHidden(true);
          await dismissCookieNoticeAction(formData);
        }}
        className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 text-sm"
      >
        <p>
          We use only the cookies needed to run this site, such as keeping you logged in. No advertising or tracking cookies.
          Read our{" "}
          <Link className="underline" href={policyPath(COOKIE_POLICY_SLUG)}>
            Cookie Policy
          </Link>
          .
        </p>
        <input type="hidden" name="version" value={version ?? 0} />
        <button
          type="submit"
          className="rounded bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700"
        >
          OK, got it
        </button>
      </form>
    </section>
  );
}

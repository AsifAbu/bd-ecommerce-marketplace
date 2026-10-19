"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonStyles, PageMain } from "@/components/ui";

/**
 * Shown when a page fails while loading or rendering. It never prints the technical message (it
 * could reveal internals); the reference number lets support find the matching server log.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageMain className="items-start justify-center gap-6 py-16 sm:py-24">
      <div className="flex max-w-xl flex-col gap-3" role="alert">
        <h1 className="text-3xl font-semibold sm:text-4xl">Something went wrong on our side</h1>
        <p className="text-muted">
          This page could not be loaded. Try again in a moment. If it keeps happening, go back to the home page, and tell us the reference below if you
          contact support.
        </p>
        {digest && (
          <p className="text-sm text-muted">
            Reference for support: <code className="rounded-sm bg-surface px-1.5 py-0.5">{digest}</code>
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => retry()}>Try again</Button>
        <Link href="/" className={buttonStyles({ variant: "secondary" })}>
          Go to the home page
        </Link>
      </div>
    </PageMain>
  );
}

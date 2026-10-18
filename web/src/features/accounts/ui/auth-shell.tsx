import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui";

/**
 * Login, sign-up and password pages: one calm centred column, no side panels. Owns the page's
 * <main> and its one <h1>.
 */
export function AuthShell({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{title}</h1>
        {intro && <p className="text-muted">{intro}</p>}
      </header>
      {children}
    </main>
  );
}

/** Suspense fallback for a list page (rows of text). */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** Suspense fallback with the footprint of a short form. */
export function FormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

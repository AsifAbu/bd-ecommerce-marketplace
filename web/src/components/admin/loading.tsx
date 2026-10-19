import { Skeleton } from "@/components/ui";

/** Suspense fallback for admin content: a few quiet rows and a status line for screen readers. */
export function AdminLoading() {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "./cn";

export interface PaginationProps {
  /** Current page, starting at 1. */
  page: number;
  totalPages: number;
  /** Builds the URL of a page: `(p) => searchHref(basePath, { ...params, page: p })`. */
  hrefFor: (page: number) => string;
  className?: string;
}

const item =
  "pressable inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-3 text-sm font-medium tabular hover:bg-surface";

/** Previous / next with page numbers on wide screens. Server-rendered links (no JavaScript). Renders nothing for a single page. */
export function Pagination({ page, totalPages, hrefFor, className }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = windowOf(page, totalPages);
  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-between gap-2", className)}>
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={item}>
          <ChevronLeft aria-hidden="true" size={16} />
          Previous
        </Link>
      ) : (
        <span aria-hidden="true" className="min-w-11" />
      )}
      <ol className="hidden items-center gap-1 sm:flex">
        {pages.map((p, i) =>
          p === null ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={hrefFor(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Page ${p}`}
                className={cn(item, p === page && "bg-ink text-paper hover:bg-ink")}
              >
                {p}
              </Link>
            </li>
          ),
        )}
      </ol>
      <span className="tabular text-sm text-muted sm:hidden">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} rel="next" className={item}>
          Next
          <ChevronRight aria-hidden="true" size={16} />
        </Link>
      ) : (
        <span aria-hidden="true" className="min-w-11" />
      )}
    </nav>
  );
}

/** Page numbers to show: first, last, and two either side of the current page; null marks a gap. */
export function windowOf(page: number, total: number): Array<number | null> {
  const keep = new Set([1, total, page - 2, page - 1, page, page + 1, page + 2].filter((p) => p >= 1 && p <= total));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: Array<number | null> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

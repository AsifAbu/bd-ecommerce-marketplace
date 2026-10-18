import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { cn } from "./cn";

export interface Crumb {
  label: string;
  /** Leave out for the current page (the last crumb). */
  href?: string;
}

/** Breadcrumb trail; the last item is the current page (aria-current). Truncates long labels, wraps on phones. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn("text-sm text-muted", className)}>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={`${c.label}-${i}`}>
              <li className="min-w-0">
                {c.href && !last ? (
                  <Link href={c.href} className="rounded-sm py-1 hover:text-ink hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className={cn("block max-w-[16rem] truncate", last && "text-ink")}>
                    {c.label}
                  </span>
                )}
              </li>
              {!last && (
                <li aria-hidden="true" className="flex">
                  <ChevronRight size={14} />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

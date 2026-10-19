"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

export interface SectionNavItem {
  href: string;
  label: string;
  /** Active only on this exact path (the section's home). Others are active on any path below. */
  exact?: boolean;
}

const isActive = (pathname: string, item: SectionNavItem) =>
  item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

/**
 * Navigation between the pages of one area (account, seller centre). A scrollable tab row with an
 * underline on phones and tablets (contained scroll, never page overflow); a vertical list from lg.
 * `aria-current="page"` marks the current page. Render it inside <Suspense> (it reads the pathname).
 */
export function SectionNav({ label, items }: { label: string; items: SectionNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mx-4 sm:-mx-6 lg:mx-0">
      <ul className="flex gap-1 overflow-x-auto overscroll-x-contain px-4 sm:px-6 lg:flex-col lg:overflow-visible lg:px-0">
        {items.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 items-center whitespace-nowrap rounded-md px-3 text-base transition-colors duration-[var(--duration-fast)]",
                  "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:bg-jade after:transition-transform after:duration-[var(--duration-base)] after:ease-[var(--ease-out)] after:content-['']",
                  "lg:after:hidden",
                  active ? "font-semibold text-ink after:scale-x-100 lg:bg-jade-soft lg:text-jade-hover" : "text-muted hover:text-ink lg:hover:bg-surface",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Placeholder with the same height while the nav's route data loads. */
export function SectionNavSkeleton() {
  return <div aria-hidden="true" className="h-11 lg:h-72" />;
}

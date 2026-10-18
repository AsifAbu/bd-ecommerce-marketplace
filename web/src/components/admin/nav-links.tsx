"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/components/ui";
import { ADMIN_NAV_GROUPS, type AdminNavItem } from "./nav-items";

/** The section whose href is the longest prefix of the path wins, so /admin/catalog/requests is not "Categories". */
function currentHref(pathname: string): string | null {
  let best: string | null = null;
  for (const g of ADMIN_NAV_GROUPS) {
    for (const it of g.items) {
      const hit = pathname === it.href || pathname.startsWith(`${it.href}/`);
      if (hit && (!best || it.href.length > best.length)) best = it.href;
    }
  }
  return best;
}

function NavLink({ item, active, waiting }: { item: AdminNavItem; active: boolean; waiting: number }) {
  const count = item.href === "/admin/shops" ? waiting : 0;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm lg:min-h-9",
        "max-lg:rounded-none max-lg:px-3 max-lg:after:absolute max-lg:after:inset-x-3 max-lg:after:bottom-0 max-lg:after:h-0.5 max-lg:after:origin-left max-lg:after:scale-x-0 max-lg:after:bg-jade max-lg:after:transition-transform max-lg:hover:after:scale-x-50 max-lg:aria-[current=page]:after:scale-x-100",
        "transition-colors hover:bg-surface",
        active ? "font-semibold text-jade-hover lg:bg-jade-soft lg:hover:bg-jade-soft" : "text-ink",
      )}
    >
      {item.label}
      {count > 0 && (
        <span className="tabular inline-flex min-w-5 items-center justify-center rounded-full bg-vermilion px-1.5 text-xs font-semibold leading-5 text-paper">
          {count}
          <span className="sr-only"> waiting</span>
        </span>
      )}
    </Link>
  );
}

function Links({ waiting, pathname }: { waiting: number; pathname: string | null }) {
  const active = pathname ? currentHref(pathname) : null;
  return (
    <ul className="flex gap-1 max-lg:overflow-x-auto max-lg:px-2 lg:flex-col lg:gap-5 lg:px-0">
      {ADMIN_NAV_GROUPS.map((g) => (
        <li key={g.label} className="contents lg:block">
          <p className="hidden px-3 pb-1 text-xs font-medium text-muted lg:block">{g.label}</p>
          <ul className="contents lg:flex lg:flex-col lg:gap-0.5">
            {g.items.map((it) => (
              <li key={it.href} className="shrink-0">
                <NavLink item={it} active={it.href === active} waiting={waiting} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function Active({ waiting }: { waiting: number }) {
  return <Links waiting={waiting} pathname={usePathname()} />;
}

/**
 * Section navigation of the admin area. Phones and tablets: one horizontally scrolling row of tabs
 * (the scroll stays inside the row). From lg: a sidebar grouped by Review, Marketplace, Catalog,
 * People and Compliance. Plain links, so it works without JavaScript; the current section has
 * aria-current="page".
 */
export function AdminNavLinks({ waiting }: { waiting: number }) {
  return (
    <nav
      aria-label="Admin sections"
      className="sticky top-14 z-20 -mx-4 border-b border-line bg-paper sm:-mx-6 lg:top-20 lg:mx-0 lg:w-56 lg:shrink-0 lg:self-start lg:border-b-0"
    >
      <Suspense fallback={<Links waiting={waiting} pathname={null} />}>
        <Active waiting={waiting} />
      </Suspense>
    </nav>
  );
}

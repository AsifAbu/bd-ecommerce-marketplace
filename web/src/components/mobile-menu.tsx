"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "./ui";

export interface DrawerCategory {
  id: string;
  slug: string;
  name: string;
  count: number;
}

const subscribe = () => () => {};
/** False while rendering on the server and during hydration, true afterwards. */
function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

const row = "flex min-h-11 items-center justify-between gap-2 rounded-md px-3 py-2 text-base hover:bg-surface";

/**
 * Phone menu button + left drawer with categories and a few quick links. Without JavaScript the
 * button is a plain link to the categories page (the tab bar has the same link).
 */
export function MobileMenu({ categories }: { categories: DrawerCategory[] }) {
  const hydrated = useHydrated();
  const trigger = "pressable inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-surface";
  if (!hydrated) {
    return (
      <Link href="/categories" aria-label="Categories" className={trigger}>
        <Menu aria-hidden="true" size={22} />
      </Link>
    );
  }
  return (
    <Sheet>
      <SheetTrigger aria-label="Open menu" className={trigger}>
        <Menu aria-hidden="true" size={22} />
      </SheetTrigger>
      <SheetContent title="Browse">
        <ul className="px-2 pb-2">
          {categories.map((c) => (
            <li key={c.id}>
              <SheetClose asChild>
                <Link href={`/c/${c.slug}`} className={row}>
                  {c.name}
                  <span className="tabular text-sm text-muted">{c.count}</span>
                </Link>
              </SheetClose>
            </li>
          ))}
          <li>
            <SheetClose asChild>
              <Link href="/categories" className={`${row} font-medium text-jade`}>
                All categories
              </Link>
            </SheetClose>
          </li>
        </ul>
        <ul className="mt-2 border-t border-line px-2 py-2">
          <li>
            <SheetClose asChild>
              <Link href="/track" className={row}>
                Track order
              </Link>
            </SheetClose>
          </li>
          <li>
            <SheetClose asChild>
              <Link href="/account/wishlist" className={row}>
                Wishlist
              </Link>
            </SheetClose>
          </li>
          <li>
            <SheetClose asChild>
              <Link href="/shops/apply" className={row}>
                Sell on Marketplace
              </Link>
            </SheetClose>
          </li>
        </ul>
      </SheetContent>
    </Sheet>
  );
}

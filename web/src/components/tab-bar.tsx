"use client";

import { Grid2x2, House, Search, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const tab = "pressable relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Bottom tab bar for phones (hidden from lg): Home, Categories, Search, Cart (with the item count
 * passed in as `cartBadge`) and Account. All plain links, so it works without JavaScript; the
 * active tab is marked with aria-current. Respects the iPhone home-indicator safe area.
 */
export function TabBar({ cartBadge }: { cartBadge: ReactNode }) {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "Home", icon: House },
    { href: "/categories", label: "Categories", icon: Grid2x2 },
    { href: "/search", label: "Search", icon: Search },
    { href: "/cart", label: "Cart", icon: ShoppingBag },
    { href: "/account", label: "Account", icon: User },
  ];
  return (
    <nav
      aria-label="Main tabs"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={`${tab} ${active ? "font-semibold text-jade" : "text-muted"}`}>
                <span className="relative">
                  <Icon aria-hidden="true" size={22} strokeWidth={active ? 2.25 : 1.75} />
                  {href === "/cart" && cartBadge}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

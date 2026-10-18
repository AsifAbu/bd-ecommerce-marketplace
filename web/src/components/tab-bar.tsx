"use client";

import { Grid2x2, House, Search, ShoppingBag, User, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

const tab = "pressable relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs";

const items: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/", label: "Home", icon: House },
  { href: "/categories", label: "Categories", icon: Grid2x2 },
  { href: "/search", label: "Search", icon: Search },
  { href: "/cart", label: "Cart", icon: ShoppingBag },
  { href: "/account", label: "Account", icon: User },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function TabItem({ href, label, icon: Icon, active, badge }: { href: string; label: string; icon: LucideIcon; active: boolean; badge?: ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`${tab} ${active ? "font-semibold text-jade" : "text-muted"}`}>
      <span className="relative">
        <Icon aria-hidden="true" size={22} strokeWidth={active ? 2.25 : 1.75} />
        {badge}
      </span>
      {label}
    </Link>
  );
}

// Reads the pathname (a client hook that needs Suspense on dynamic routes); the fallback is the same tab, inactive.
function ActiveTab(props: { href: string; label: string; icon: LucideIcon; badge?: ReactNode }) {
  const pathname = usePathname();
  return <TabItem {...props} active={isActive(pathname, props.href)} />;
}

/**
 * Bottom tab bar for phones (hidden from lg): Home, Categories, Search, Cart (with the item count
 * passed in as `cartBadge`) and Account. All plain links, so it works without JavaScript; the
 * active tab is marked with aria-current. Respects the iPhone home-indicator safe area.
 */
export function TabBar({ cartBadge }: { cartBadge: ReactNode }) {
  return (
    <nav
      aria-label="Main tabs"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const badge = item.href === "/cart" ? cartBadge : undefined;
          return (
            <li key={item.href}>
              <Suspense fallback={<TabItem {...item} active={false} badge={badge} />}>
                <ActiveTab {...item} badge={badge} />
              </Suspense>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

import Link from "next/link";
import { connection } from "next/server";
import { auth } from "@/auth";
import { LogoutButton } from "@/features/accounts/ui/page-shell";
import { adminWaiting, loadMenuData, type MenuData } from "@/lib/menu-data";
import { ChevronDown } from "lucide-react";
import { buttonStyles, DisclosureMenu, menuItemStyles } from "./ui";

const itemClass = menuItemStyles;
const headingClass = "px-3 pb-1 pt-3 text-xs font-medium text-muted";

/** Logged out: a Log in link and a Sign up button. Logged in: the user's name with a dropdown. */
export async function AccountMenu() {
  await connection(); // session reads are request-time (Cache Components)
  const session = await auth();
  const userId = session?.user?.id;
  let data: MenuData | null = null;
  if (userId) {
    try {
      data = await loadMenuData(userId);
    } catch {
      // The menu is a convenience: show a plain account link if the database can't be read.
      data = null;
    }
  }
  if (!userId) return <GuestLinks />;
  if (!data) {
    return (
      <Link className={buttonStyles({ variant: "secondary", size: "sm" })} href="/account">
        My account
      </Link>
    );
  }
  return <UserDropdown data={data} />;
}

export function GuestLinks() {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Link href="/login" className={buttonStyles({ variant: "ghost", size: "sm" })}>
        Log in
      </Link>
      <Link href="/signup" className={buttonStyles({ size: "sm" })}>
        Sign up
      </Link>
    </div>
  );
}

function UserDropdown({ data }: { data: MenuData }) {
  const waiting = data.admin ? adminWaiting(data.admin) : 0;
  return (
    <DisclosureMenu
      summaryLabel={`Account menu for ${data.displayName}`}
      summaryClassName="border border-line px-2 sm:pl-2 sm:pr-3"
      summary={
        <>
          <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-jade text-xs font-semibold text-paper">
            {data.displayName.replace(/^\[TEST\]\s*/, "").charAt(0).toUpperCase()}
          </span>
          <span className="hidden max-w-32 truncate sm:inline">{data.displayName}</span>
          {waiting > 0 && (
            <span className="tabular rounded-full bg-vermilion px-1.5 text-xs text-paper" title="Waiting for your review">
              {waiting}
            </span>
          )}
          <ChevronDown aria-hidden="true" size={16} className="hidden transition-transform group-open:rotate-180 sm:block" />
        </>
      }
      panelClassName="w-72"
    >
        <ul>
          <li>
            <Link href="/account" className={`${itemClass} font-semibold`}>
              My profile
            </Link>
          </li>
          <li>
            <Link href="/account/orders" className={itemClass}>
              My orders
            </Link>
          </li>
          <li>
            <Link href="/account/wishlist" className={itemClass}>
              Wishlist
            </Link>
          </li>
          <li>
            <Link href="/account/addresses" className={itemClass}>
              My addresses
            </Link>
          </li>
          <li>
            <Link href="/account/reviews" className={itemClass}>
              My reviews
            </Link>
          </li>
          <li>
            <Link href="/account/returns" className={itemClass}>
              My returns
            </Link>
          </li>
          <li>
            <Link href="/account/complaints" className={itemClass}>
              My complaints
            </Link>
          </li>
        </ul>

        <p className={headingClass}>Selling</p>
        <ul>
          {data.shops.map((s) => (
            <li key={s.id}>
              <Link href={`/seller/${s.id}`} className={itemClass}>
                <span className="truncate">{s.name}</span>
                <span className={`ml-2 shrink-0 text-xs ${s.status === "approved" ? "text-jade" : "text-gold-ink"}`}>
                  {s.status === "approved" ? s.role : s.status}
                </span>
              </Link>
            </li>
          ))}
          <li>
            <Link href="/shops/apply" className={`${itemClass} font-medium text-jade`}>
              {data.shops.length ? "Open another shop" : "Open a shop"}
            </Link>
          </li>
        </ul>

        {data.isPlatformAdmin && data.admin && (
          <>
            <p className={headingClass}>Platform admin</p>
            <ul>
              <li>
                <Link href="/admin/shops" className={`${itemClass} font-semibold`}>
                  Approve shops
                  <Count n={data.admin.pendingShops + data.admin.pendingUpgrades + data.admin.pendingLicences} />
                </Link>
              </li>
              <AdminLink href="/admin/users">Users</AdminLink>
              <AdminLink href="/admin/catalog">Categories and attributes</AdminLink>
              <AdminLink href="/admin/catalog/requests">Category requests</AdminLink>
              <AdminLink href="/admin/orders">All shop orders</AdminLink>
              <AdminLink href="/admin/returns">Returns</AdminLink>
              <AdminLink href="/admin/complaints">Complaints</AdminLink>
              <AdminLink href="/admin/reviews">Reviews</AdminLink>
              <AdminLink href="/admin/payouts">Payouts</AdminLink>
              <AdminLink href="/admin/metrics">Marketplace metrics</AdminLink>
              <AdminLink href="/admin/policies">Policies</AdminLink>
              <AdminLink href="/admin/compliance">Compliance</AdminLink>
            </ul>
          </>
        )}

        <div className="mt-1 border-t border-line px-3 py-2 text-sm">
          <LogoutButton />
        </div>
    </DisclosureMenu>
  );
}

function AdminLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className={itemClass}>
        {children}
      </Link>
    </li>
  );
}

function Count({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span className="tabular ml-2 rounded-full bg-vermilion px-2 text-xs font-semibold text-paper">{n} waiting</span>;
}

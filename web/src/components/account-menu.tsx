import Link from "next/link";
import { connection } from "next/server";
import { auth } from "@/auth";
import { LogoutButton } from "@/features/accounts/ui/page-shell";
import { adminWaiting, loadMenuData, type MenuData } from "@/lib/menu-data";
import { ChevronDown, Store } from "lucide-react";
import { Badge, buttonStyles, DisclosureMenu, menuItemStyles } from "./ui";

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
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {data.shops.length > 0 && <ShopMenu shops={data.shops} />}
      <UserDropdown data={data} />
    </div>
  );
}

/** Who the user is on this site, for the badge in the account menu. */
export function roleLabel(data: Pick<MenuData, "isPlatformAdmin" | "shops">): string {
  if (data.isPlatformAdmin) return "Admin";
  if (data.shops.some((s) => s.role === "owner")) return "Shop owner";
  if (data.shops.some((s) => s.role === "staff")) return "Shop staff";
  return "Customer";
}

/** Shop things (add a product, products, orders) for owners and staff; "me" things stay in the account menu. */
function ShopMenu({ shops }: { shops: MenuData["shops"] }) {
  return (
    <DisclosureMenu
      summaryLabel="My shop menu"
      summaryClassName="border border-line px-2 sm:px-3"
      summary={
        <>
          <Store aria-hidden="true" size={18} />
          <span className="hidden sm:inline">My shop</span>
          <ChevronDown aria-hidden="true" size={16} className="hidden transition-transform group-open:rotate-180 sm:block" />
        </>
      }
      panelClassName="w-72"
    >
      {shops.map((s) => {
        const base = `/seller/${s.id}`;
        return (
          <section key={s.id} aria-label={s.name} className="border-b border-line pb-1 last:border-b-0">
            <p className="flex items-center justify-between gap-2 px-3 pb-1 pt-3 text-xs font-medium text-muted">
              <span className="truncate">{s.name}</span>
              <span className={`shrink-0 ${s.status === "approved" ? "text-jade" : "text-gold-ink"}`}>
                {s.status === "approved" ? s.role : s.status}
              </span>
            </p>
            <ul>
              <li>
                <Link href={`${base}/products/new`} className={`${itemClass} font-semibold text-jade`}>
                  Add a product
                </Link>
              </li>
              <li>
                <Link href={`${base}/products`} className={itemClass}>
                  Products
                </Link>
              </li>
              <li>
                <Link href={`${base}/orders`} className={itemClass}>
                  Orders
                </Link>
              </li>
              <li>
                <Link href={base} className={itemClass}>
                  Shop dashboard
                </Link>
              </li>
              {s.role === "owner" && (
                <li>
                  <Link href={`${base}/payouts`} className={itemClass}>
                    Payouts
                  </Link>
                </li>
              )}
            </ul>
          </section>
        );
      })}
      <div className="border-t border-line">
        <Link href="/shops/apply" className={`${itemClass} font-medium text-jade`}>
          Open another shop
        </Link>
      </div>
    </DisclosureMenu>
  );
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
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
          <span className="min-w-0 truncate text-sm font-medium">{data.displayName}</span>
          <Badge tone="neutral" className="shrink-0">
            {roleLabel(data)}
          </Badge>
        </div>
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

        {data.shops.length === 0 && (
          <ul>
            <li>
              <Link href="/shops/apply" className={`${itemClass} font-medium text-jade`}>
                Open a shop
              </Link>
            </li>
          </ul>
        )}

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

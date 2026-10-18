import Link from "next/link";
import { connection } from "next/server";
import { auth } from "@/auth";
import { LogoutButton } from "@/features/accounts/ui/page-shell";
import { adminWaiting, loadMenuData, type MenuData } from "@/lib/menu-data";

const itemClass =
  "flex items-center justify-between rounded px-3 py-2 text-sm hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700";
const headingClass = "px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-600";

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
      <Link className="rounded border border-gray-400 px-3 py-1.5 text-sm font-semibold hover:bg-gray-50" href="/account">
        My account
      </Link>
    );
  }
  return <UserDropdown data={data} />;
}

export function GuestLinks() {
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="rounded border border-blue-700 px-3 py-1.5 text-sm font-semibold text-blue-800 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        Log in
      </Link>
      <Link
        href="/signup"
        className="rounded bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        Sign up
      </Link>
    </div>
  );
}

function UserDropdown({ data }: { data: MenuData }) {
  const waiting = data.admin ? adminWaiting(data.admin) : 0;
  return (
    <details className="group relative">
      <summary
        aria-label={`Account menu for ${data.displayName}`}
        className="flex cursor-pointer list-none items-center gap-2 rounded border border-gray-400 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 [&::-webkit-details-marker]:hidden"
      >
        <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-700 text-xs text-white">
          {data.displayName.replace(/^\[TEST\]\s*/, "").charAt(0).toUpperCase()}
        </span>
        <span className="max-w-40 truncate">{data.displayName}</span>
        {waiting > 0 && (
          <span className="rounded-full bg-red-600 px-1.5 text-xs text-white" title="Waiting for your review">
            {waiting}
          </span>
        )}
        <span aria-hidden="true" className="text-xs transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="absolute right-0 top-full z-30 mt-1 max-h-[80vh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-gray-300 bg-white p-2 shadow-lg">
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
                <span className={`ml-2 shrink-0 text-xs ${s.status === "approved" ? "text-green-800" : "text-amber-800"}`}>
                  {s.status === "approved" ? s.role : s.status}
                </span>
              </Link>
            </li>
          ))}
          <li>
            <Link href="/shops/apply" className={`${itemClass} font-semibold text-blue-800`}>
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

        <div className="mt-2 border-t border-gray-200 px-3 pb-1 pt-2 text-sm">
          <LogoutButton />
        </div>
      </div>
    </details>
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
  return <span className="ml-2 rounded-full bg-red-600 px-2 text-xs font-semibold text-white">{n} waiting</span>;
}

import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { auth } from "@/auth";
import { CartLink } from "@/features/cart/ui/cart-link";
import { AccountMenu, GuestLinks } from "./account-menu";
import { CategoryLink, CategoryMenu } from "./category-menu";
import { SiteSearch } from "./site-search";

/**
 * Site header: the marketplace name, the categories menu and search box, quick links (guests:
 * order tracking; users: orders and wishlist), the cart with its item count, and on the far right
 * the Log in / Sign up buttons or, when logged in, the user's name with the account menu
 * (profile, orders, their shops, and the admin pages for a Platform Admin).
 */
export function SiteHeader() {
  return (
    <header className="border-b border-gray-300 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="text-xl font-bold text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
          Marketplace
        </Link>
        <Suspense fallback={<CategoryLink />}>
          <CategoryMenu />
        </Suspense>
        <SiteSearch />
        <nav aria-label="Your links" className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Suspense fallback={null}>
            <UserLinks />
          </Suspense>
          <Suspense
            fallback={
              <Link className="underline" href="/cart">
                Cart
              </Link>
            }
          >
            <CartLink />
          </Suspense>
          <Suspense fallback={<GuestLinks />}>
            <AccountMenu />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

async function UserLinks() {
  await connection(); // session reads are request-time (Cache Components)
  const session = await auth();
  if (!session?.user) {
    // US-008: guests track an order with its number and an SMS code.
    return (
      <>
        <Link className="underline" href="/track">
          Track order
        </Link>
        <Link className="underline" href="/account/wishlist">
          Wishlist
        </Link>
      </>
    );
  }
  return (
    <>
      <Link className="underline" href="/account/orders">
        My orders
      </Link>
      <Link className="underline" href="/account/wishlist">
        Wishlist
      </Link>
    </>
  );
}

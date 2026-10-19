import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { auth } from "@/auth";
import { CartLink } from "@/features/cart/ui/cart-link";
import { AccountMenu, GuestLinks } from "./account-menu";
import { CategoryLink, CategoryMenu, loadCategoryTree } from "./category-menu";
import { MobileMenu } from "./mobile-menu";
import { SiteSearch } from "./site-search";

const quietLink = "pressable inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium hover:bg-surface";

/**
 * Site header, sticky. Phones: menu button (opens the category drawer), the wordmark and the
 * account menu; Search and Cart live in the bottom tab bar. From lg: wordmark, "Browse categories"
 * menu, a wide search box, quick links (guests: Track order, Wishlist; users: My orders,
 * Wishlist), the cart with its item count, and the Log in / Sign up buttons or, when logged in,
 * the account menu (profile, orders, shops, admin pages).
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper">
      <div className="mx-auto flex min-h-14 w-full max-w-[var(--container-page)] items-center gap-2 px-2 sm:px-6 lg:gap-4">
        <div className="lg:hidden">
          <Suspense fallback={<MobileMenu categories={[]} />}>
            <MobileDrawer />
          </Suspense>
        </div>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-md px-1 text-xl font-semibold tracking-tight lg:px-0 lg:text-2xl">
          Marketplace
        </Link>
        <div className="hidden lg:block">
          <Suspense fallback={<CategoryLink />}>
            <CategoryMenu />
          </Suspense>
        </div>
        <div className="hidden min-w-0 max-w-xl flex-1 lg:flex">
          <SiteSearch />
        </div>
        <nav aria-label="Your links" className="ml-auto flex items-center gap-1">
          <div className="hidden items-center gap-1 lg:flex">
            <Suspense fallback={null}>
              <UserLinks />
            </Suspense>
            <Suspense
              fallback={
                <Link className={quietLink} href="/cart">
                  Cart
                </Link>
              }
            >
              <CartLink />
            </Suspense>
          </div>
          <Suspense fallback={<GuestLinks />}>
            <AccountMenu />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

async function MobileDrawer() {
  const tree = await loadCategoryTree();
  return <MobileMenu categories={tree.map((c) => ({ id: c.id, slug: c.slug, name: c.name, count: c.count }))} />;
}

async function UserLinks() {
  await connection(); // session reads are request-time (Cache Components)
  const session = await auth();
  if (!session?.user) {
    // US-008: guests track an order with its number and an SMS code.
    return (
      <>
        <Link className={quietLink} href="/track">
          Track order
        </Link>
        <Link className={quietLink} href="/account/wishlist">
          Wishlist
        </Link>
      </>
    );
  }
  return (
    <>
      <Link className={quietLink} href="/account/orders">
        My orders
      </Link>
      <Link className={quietLink} href="/account/wishlist">
        Wishlist
      </Link>
    </>
  );
}

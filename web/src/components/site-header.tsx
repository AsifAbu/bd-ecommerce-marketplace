import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { auth } from "@/auth";
import { SiteSearch } from "./site-search";

/**
 * Site header: the marketplace name, the categories link and search box (Sprint 5), and for
 * logged-in users a link to their wishlist.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-gray-300">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold">
          Marketplace
        </Link>
        <SiteSearch />
        <nav aria-label="Your links" className="ml-auto flex gap-4 text-sm">
          <Suspense fallback={null}>
            <UserLinks />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

async function UserLinks() {
  await connection(); // session reads are request-time (Cache Components)
  const session = await auth();
  if (!session?.user) return null;
  return (
    <Link className="underline" href="/account/wishlist">
      Wishlist
    </Link>
  );
}

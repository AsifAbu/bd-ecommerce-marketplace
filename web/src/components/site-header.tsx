import Link from "next/link";
import { SiteSearch } from "./site-search";

/**
 * Site header: the marketplace name, then the categories link and search box (Sprint 5).
 * Kept small; the product-page branch adds the wishlist link on the right.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-gray-300">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold">
          Marketplace
        </Link>
        <SiteSearch />
      </div>
    </header>
  );
}

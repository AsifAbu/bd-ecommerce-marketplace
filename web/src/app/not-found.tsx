import Link from "next/link";
import { buttonStyles, PageMain } from "@/components/ui";

export const metadata = { title: "Page not found" };

/** Any URL that does not exist, and pages the visitor may not see (admin and other shops' pages answer with this too). */
export default function NotFound() {
  return (
    <PageMain className="items-start justify-center gap-6 py-16 sm:py-24">
      <div className="flex max-w-xl flex-col gap-3">
        <p className="tabular text-lg font-semibold text-muted">404</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">We could not find that page</h1>
        <p className="text-muted">
          The page you asked for could not be found. The link may be mistyped or out of date, or the page may have moved. If you followed a link from the
          marketplace, try searching instead.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className={buttonStyles()}>
          Go to the home page
        </Link>
        <Link href="/search" className={buttonStyles({ variant: "secondary" })}>
          Search products
        </Link>
        <Link href="/categories" className={buttonStyles({ variant: "secondary" })}>
          Browse categories
        </Link>
      </div>
    </PageMain>
  );
}

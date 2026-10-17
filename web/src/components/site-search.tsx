import Form from "next/form";
import Link from "next/link";

/** The header's category link and product search box (US-040, US-041). Static: no session reads. */
export function SiteSearch() {
  return (
    <>
      <Link href="/categories" className="text-blue-800 underline">
        Categories
      </Link>
      <Form action="/search" role="search" aria-label="Site search" className="flex min-w-48 flex-1 gap-2">
        <label htmlFor="site-search-q" className="sr-only">
          Search products
        </label>
        <input
          id="site-search-q"
          name="q"
          type="search"
          maxLength={100}
          placeholder="Search products, e.g. processor, boi, শাড়ি"
          className="w-full rounded border border-gray-400 px-3 py-1.5 focus:outline-2 focus:outline-offset-1 focus:outline-blue-700"
        />
        <button
          type="submit"
          className="rounded bg-blue-700 px-3 py-1.5 font-semibold text-white hover:bg-blue-800 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700"
        >
          Search
        </button>
      </Form>
    </>
  );
}

import { Search } from "lucide-react";
import Form from "next/form";
import { controlStyles } from "./ui";

/** The header's product search box (US-041). Static: no session reads. Shown from lg; phones use the Search tab. */
export function SiteSearch() {
  return (
    <Form action="/search" role="search" aria-label="Site search" className="relative min-w-0 flex-1">
      <label htmlFor="site-search-q" className="sr-only">
        Search products
      </label>
      <input
        id="site-search-q"
        name="q"
        type="search"
        maxLength={100}
        placeholder="Search products, e.g. processor, boi, শাড়ি"
        className={`${controlStyles} !min-h-10 border-line bg-surface pr-11 hover:border-edge focus-visible:bg-paper`}
      />
      <button
        type="submit"
        aria-label="Search"
        className="pressable absolute right-0 top-0 inline-flex h-10 w-11 items-center justify-center rounded-md text-muted hover:text-jade"
      >
        <Search aria-hidden="true" size={18} />
      </button>
    </Form>
  );
}

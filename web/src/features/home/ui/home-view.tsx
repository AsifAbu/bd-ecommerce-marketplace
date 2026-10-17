import Form from "next/form";
import Link from "next/link";
import { initialOf, toneFor } from "@/components/product-thumb-style";
import { storefrontPath } from "@/lib/storefront-link";
import type { HomeData } from "../loader";
import { ProductGrid } from "./home-product-card";

const sectionHeading = "text-2xl font-bold";
const seeAll = "text-sm font-semibold text-blue-800 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

export function Hero({ children }: { children?: React.ReactNode }) {
  return (
    <section aria-labelledby="home-title" className="rounded-2xl bg-gradient-to-br from-blue-800 to-blue-600 px-6 py-10 text-white sm:px-10 sm:py-14">
      <h1 id="home-title" className="text-3xl font-bold sm:text-4xl">
        Welcome to Marketplace
      </h1>
      <p className="mt-2 max-w-xl text-lg text-blue-50">All online products in one place, from shops across Bangladesh.</p>
      <Form action="/search" role="search" aria-label="Search the marketplace" className="mt-6 flex max-w-xl gap-2">
        <label htmlFor="hero-search-q" className="sr-only">
          Search the marketplace
        </label>
        <input
          id="hero-search-q"
          name="q"
          type="search"
          maxLength={100}
          placeholder="What are you looking for? e.g. processor, boi, শাড়ি"
          className="min-w-0 flex-1 rounded-lg bg-white px-4 py-3 text-base text-gray-900 focus:outline-2 focus:outline-offset-2 focus:outline-white"
        />
        <button
          type="submit"
          className="rounded-lg bg-amber-400 px-5 py-3 font-semibold text-gray-900 hover:bg-amber-300 focus:outline-2 focus:outline-offset-2 focus:outline-white"
        >
          Search
        </button>
      </Form>
      {children && <div className="mt-4 text-sm text-blue-50">{children}</div>}
    </section>
  );
}

export function EmptyHome() {
  return (
    <section aria-labelledby="empty-title" className="rounded-lg border border-gray-300 bg-gray-50 p-8 text-center">
      <h2 id="empty-title" className="text-xl font-semibold">
        No products are listed yet
      </h2>
      <p className="mt-2 text-gray-700">Shops are getting ready. Please check back soon.</p>
      <p className="mt-2 text-sm text-gray-600">
        Developer hint: run <code className="rounded bg-white px-1">npm run seed</code> in <code className="rounded bg-white px-1">web/</code> to add test shops and
        products.
      </p>
    </section>
  );
}

export function HomeSections({ data }: { data: HomeData }) {
  if (data.isEmpty) return <EmptyHome />;
  return (
    <>
      {data.categories.length > 0 && (
        <section aria-labelledby="shop-by-category" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="shop-by-category" className={sectionHeading}>
              Shop by category
            </h2>
            <Link className={seeAll} href="/categories">
              All categories
            </Link>
          </div>
          <ul aria-label="Category tiles" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/c/${c.slug}`}
                  className={`flex h-full items-center gap-3 rounded-lg p-4 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${toneFor(c.name)}`}
                >
                  <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/70 text-xl font-bold">
                    {initialOf(c.name)}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{c.name}</span>
                    <span className="text-sm">{c.count === 1 ? "1 product" : `${c.count} products`}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.arrivals.length > 0 && (
        <section aria-labelledby="new-arrivals" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="new-arrivals" className={sectionHeading}>
              New arrivals
            </h2>
            <Link className={seeAll} href="/search?sort=newest">
              See all
            </Link>
          </div>
          <ProductGrid products={data.arrivals} label="New arrivals" />
        </section>
      )}

      {data.rows.map((row) => (
        <section key={row.category.id} aria-labelledby={`row-${row.category.id}`} className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id={`row-${row.category.id}`} className={sectionHeading}>
              {row.category.name}
            </h2>
            <Link className={seeAll} href={`/c/${row.category.slug}`} aria-label={`See all in ${row.category.name}`}>
              See all
            </Link>
          </div>
          <ProductGrid products={row.products} label={`${row.category.name} products`} />
        </section>
      ))}

      {data.shops.length > 0 && (
        <section aria-labelledby="featured-shops" className="flex flex-col gap-3">
          <h2 id="featured-shops" className={sectionHeading}>
            Featured shops
          </h2>
          <ul aria-label="Featured shops" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.shops.map((s) => (
              <li key={s.id}>
                <Link
                  href={storefrontPath(s.slug)}
                  className="flex h-full flex-col gap-1 rounded-lg border border-gray-300 bg-white p-4 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-sm text-gray-700">{s.productCount === 1 ? "1 product" : `${s.productCount} products`}</span>
                  {s.verified && <span className="w-fit rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-900">✓ Verified seller</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export function SellCta() {
  return (
    <section aria-labelledby="sell-cta" className="flex flex-col items-start gap-3 rounded-lg bg-gray-100 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 id="sell-cta" className="text-xl font-bold">
          Sell on Marketplace
        </h2>
        <p className="text-gray-700">Anyone can open a shop and reach customers across Bangladesh.</p>
      </div>
      <Link
        href="/shops/apply"
        className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        Open your shop
      </Link>
    </section>
  );
}

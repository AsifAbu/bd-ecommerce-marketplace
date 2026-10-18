import Form from "next/form";
import Link from "next/link";
import { Badge, buttonStyles, Input } from "@/components/ui";
import { BadgeCheck, Search } from "lucide-react";
import { storefrontPath } from "@/lib/storefront-link";
import type { HomeData } from "../loader";
import { ProductGrid } from "./home-product-card";

const sectionHeading = "text-xl font-semibold sm:text-2xl";
const seeAll = "shrink-0 py-1 text-sm font-medium text-jade underline-offset-4 hover:underline";

export function Hero({ children }: { children?: React.ReactNode }) {
  return (
    <section aria-labelledby="home-title" className="flex flex-col gap-4 rounded-lg bg-surface px-5 py-8 sm:px-8 sm:py-10">
      <div>
        <h1 id="home-title" className="text-3xl font-semibold sm:text-4xl">
          Marketplace
        </h1>
        <p className="mt-2 max-w-xl text-lg text-muted">All online products in one place, from shops across Bangladesh.</p>
      </div>
      <Form action="/search" role="search" aria-label="Search the marketplace" className="flex max-w-xl gap-2">
        <label htmlFor="hero-search-q" className="sr-only">
          Search the marketplace
        </label>
        <Input
          id="hero-search-q"
          name="q"
          type="search"
          maxLength={100}
          placeholder="What are you looking for? e.g. processor, boi, শাড়ি"
          className="min-w-0 flex-1"
        />
        <button type="submit" className={buttonStyles()}>
          <Search aria-hidden="true" size={18} />
          Search
        </button>
      </Form>
      {children && <div className="text-sm text-muted">{children}</div>}
    </section>
  );
}

export function EmptyHome() {
  return (
    <section aria-labelledby="empty-title" className="rounded-lg bg-surface p-8">
      <h2 id="empty-title" className="text-xl font-semibold">
        No products are listed yet
      </h2>
      <p className="mt-2 text-muted">Shops are getting ready. Please check back soon.</p>
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
                  className="flex h-full min-h-16 flex-col justify-center gap-0.5 rounded-md bg-surface px-4 py-3 transition-colors hover:bg-line"
                >
                  <span className="truncate font-medium">{c.name}</span>
                  <span className="tabular text-sm text-muted">{c.count === 1 ? "1 product" : `${c.count} products`}</span>
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
                  className="flex h-full flex-col gap-1 rounded-md bg-surface px-4 py-3 transition-colors hover:bg-line"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="tabular text-sm text-muted">{s.productCount === 1 ? "1 product" : `${s.productCount} products`}</span>
                  {s.verified && (
                    <Badge tone="brand" className="w-fit">
                      <BadgeCheck aria-hidden="true" size={14} />
                      Verified seller
                    </Badge>
                  )}
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
    <section aria-labelledby="sell-cta" className="flex flex-col items-start gap-4 rounded-lg bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 id="sell-cta" className="text-xl font-semibold">
          Sell on Marketplace
        </h2>
        <p className="text-muted">Anyone can open a shop and reach customers across Bangladesh.</p>
      </div>
      <Link href="/shops/apply" className={buttonStyles()}>
        Open your shop
      </Link>
    </section>
  );
}

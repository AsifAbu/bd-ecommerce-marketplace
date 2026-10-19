import { BadgeCheck, Search } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { Button, buttonStyles, EmptyState, Input, ProductGridSkeleton, Section, Skeleton } from "@/components/ui";
import { storefrontPath } from "@/lib/storefront-link";
import type { HomeData } from "../loader";
import { ProductGrid } from "./home-product-card";

/**
 * Grids hold more products than a short row needs on some widths (2, 3, 4 or 5 columns); the
 * extra tiles are hidden by CSS so every row ends on a full line. Hidden images are lazy and
 * never download.
 */
const ARRIVALS_CLIP = "max-sm:[&>li:nth-child(n+9)]:hidden sm:max-lg:[&>li:nth-child(n+10)]:hidden lg:max-xl:[&>li:nth-child(n+9)]:hidden";
const ROW_CLIP = "max-sm:[&>li:nth-child(n+5)]:hidden sm:max-lg:[&>li:nth-child(n+4)]:hidden lg:max-xl:[&>li:nth-child(n+5)]:hidden";

const count = (n: number, noun: string) => `${n.toLocaleString("en-US")} ${noun}${n === 1 ? "" : "s"}`;

/** The top of the page: the wordmark as the title, one line of purpose and the search box. */
export function Hero() {
  return (
    <section aria-labelledby="home-title" className="flex flex-col gap-5 pt-2 sm:pt-6">
      <div className="flex flex-col gap-1">
        <h1 id="home-title" className="flex items-center gap-1 text-4xl font-semibold">
          <LogoMark className="h-11 w-auto" />
          Dokan
        </h1>
        <p className="max-w-xl text-lg text-muted">All online products in one place, from shops across Bangladesh.</p>
      </div>
      <Form action="/search" role="search" aria-label="Search the marketplace" className="flex max-w-xl gap-2">
        <label htmlFor="hero-search-q" className="sr-only">
          Search the marketplace
        </label>
        <Input id="hero-search-q" name="q" type="search" maxLength={100} placeholder="Search, e.g. processor, boi, শাড়ি" className="min-w-0 flex-1" />
        <Button type="submit">
          <Search aria-hidden="true" size={18} />
          Search
        </Button>
      </Form>
    </section>
  );
}

/** Shown while the products load: same footprint, so nothing jumps. */
export function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-10" role="status">
      <span className="sr-only">Loading products…</span>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-md" />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-40" />
        <ProductGridSkeleton count={4} />
      </div>
    </div>
  );
}

export function EmptyHome({ testMode }: { testMode: boolean }) {
  return (
    <EmptyState
      title="No products are listed yet"
      description={
        testMode
          ? "Shops are getting ready. Developers: run npm run seed in web/ to add test shops and products."
          : "Shops are getting ready. Please check back soon, or open your own shop to be the first."
      }
      action={
        <Link href="/shops/apply" className={buttonStyles()}>
          Open your shop
        </Link>
      }
    />
  );
}

export function SellCta() {
  return (
    <section aria-labelledby="sell-cta" className="flex flex-col items-start gap-4 rounded-lg bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <h2 id="sell-cta" className="text-lg font-semibold">
          Sell on Dokan
        </h2>
        <p className="text-muted">Anyone can open a shop and reach customers across Bangladesh.</p>
      </div>
      <Link href="/shops/apply" className={buttonStyles({ variant: "secondary" })}>
        Open your shop
      </Link>
    </section>
  );
}

export function HomeSections({ data, testMode }: { data: HomeData; testMode: boolean }) {
  if (data.isEmpty) return <EmptyHome testMode={testMode} />;
  return (
    <>
      {data.categories.length > 0 && (
        <Section title="Shop by category" more={{ href: "/categories", label: "All categories" }}>
          <ul aria-label="Category tiles" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/c/${c.slug}`}
                  className="pressable flex h-full min-h-16 flex-col justify-center gap-0.5 rounded-md bg-surface px-4 py-3 hover:bg-line"
                >
                  <span className="truncate font-medium">{c.name}</span>
                  <span className="tabular text-sm text-muted">{count(c.count, "product")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {data.arrivals.length > 0 && (
        <Section title="New arrivals" more={{ href: "/search?sort=newest", label: "See all new arrivals" }}>
          <ProductGrid products={data.arrivals} label="New arrivals" className={ARRIVALS_CLIP} />
        </Section>
      )}

      {data.rows.map((row) => (
        <Section
          key={row.category.id}
          title={row.category.name}
          more={{ href: `/c/${row.category.slug}`, label: `See all in ${row.category.name}` }}
        >
          <ProductGrid products={row.products} label={`${row.category.name} products`} className={ROW_CLIP} />
        </Section>
      ))}

      {data.shops.length > 0 && (
        <Section title="Featured shops">
          <ul aria-label="Featured shops" className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
            {data.shops.map((s) => (
              <li key={s.id}>
                <Link href={storefrontPath(s.slug)} className="flex min-h-14 flex-col justify-center rounded-md py-1 hover:text-jade">
                  <span className="flex items-center gap-1 font-medium">
                    <span className="truncate">{s.name}</span>
                    {s.verified && (
                      <span className="inline-flex shrink-0 items-center text-jade">
                        <BadgeCheck aria-hidden="true" size={16} />
                        <span className="sr-only">Verified seller</span>
                      </span>
                    )}
                  </span>
                  <span className="tabular text-sm text-muted">{count(s.productCount, "product")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <SellCta />
    </>
  );
}

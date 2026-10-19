import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { Badge, Button, buttonStyles, EmptyState, FormField, Pagination, ProductCard, ProductGrid, ProductGridSkeleton, Select, Skeleton } from "@/components/ui";
import { storefrontPath } from "@/lib/storefront-link";
import { isWebUrl } from "../metadata";
import { SORT_LABELS, SORTS, storefrontQueryString, type StorefrontQuery } from "../query";
import type { StorefrontData } from "../service";
import { ShopScoreSlot } from "./shop-score-slot";

const memberSince = (d: Date) => d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Asia/Dhaka" });
const monogram = (name: string) => (name.replace(/^[^\p{L}\p{N}]+/u, "").match(/[\p{L}\p{N}]/u)?.[0] ?? "S").toUpperCase();

/** Placeholder with the shop page's footprint while it loads. */
export function StorefrontSkeleton() {
  return (
    <div className="flex flex-col gap-8" role="status">
      <span className="sr-only">Loading shop…</span>
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <ProductGridSkeleton count={8} />
    </div>
  );
}

/** US-014: one shop's public page. `data` comes from loadStorefront(). */
export function StorefrontView({ data }: { data: StorefrontData }) {
  const { shop } = data;
  const base = storefrontPath(shop.slug);
  const current: StorefrontQuery = { page: data.page, sort: data.sort, category: data.category?.slug ?? null };
  const href = (q: Partial<StorefrontQuery>) => `${base}${storefrontQueryString({ ...current, ...q })}`;

  return (
    <article className="flex flex-col gap-10">
      <header className="flex flex-col gap-5">
        {isWebUrl(shop.bannerUrl) && (
          // Shop-provided external URL; next/image would need every host allow-listed.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.bannerUrl} alt="" className="h-36 w-full rounded-lg bg-surface object-cover sm:h-52" />
        )}
        <div className="flex items-center gap-4">
          {isWebUrl(shop.logoUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shop.logoUrl} alt={`${shop.name} logo`} className="size-16 shrink-0 rounded-full bg-surface object-cover sm:size-20" />
          ) : (
            <div aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-surface text-2xl font-semibold text-muted sm:size-20 sm:text-3xl">
              {monogram(shop.name)}
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="break-words text-3xl font-semibold sm:text-4xl">{shop.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
              {shop.tier === "verified" && (
                <Badge tone="brand">
                  <BadgeCheck aria-hidden="true" size={14} />
                  Verified seller
                </Badge>
              )}
              <span>Member since {memberSince(shop.createdAt)}</span>
              <ShopScoreSlot shopId={shop.id} />
            </div>
          </div>
        </div>
        {shop.description && <p className="max-w-prose whitespace-pre-line">{shop.description}</p>}
      </header>

      <section aria-labelledby="shop-products" className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <h2 id="shop-products" className="text-xl font-semibold sm:text-2xl">
              Products{data.category && ` in ${data.category.name}`}
            </h2>
            <p className="tabular text-sm text-muted">{data.total === 1 ? "1 product" : `${data.total.toLocaleString("en-US")} products`}</p>
          </div>

          {data.categories.length > 0 && (
            <form action={base} method="get" className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
              <FormField label="Category" className="col-span-2 min-w-0 sm:col-span-1">
                {(p) => (
                  <Select name="category" defaultValue={current.category ?? ""} {...p}>
                    <option value="">All categories</option>
                    {data.categories.map((c) => (
                      <option key={c.id} value={c.slug}>
                        {c.name} ({c.count})
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField label="Sort by" className="col-span-2 min-w-0 sm:col-span-1">
                {(p) => (
                  <Select name="sort" defaultValue={current.sort} {...p}>
                    {SORTS.map((s) => (
                      <option key={s} value={s}>
                        {SORT_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <Button type="submit" variant="secondary" className="col-span-2 sm:col-span-1">
                Apply
              </Button>
            </form>
          )}
        </div>

        {data.products.length === 0 ? (
          <EmptyState
            title="No products in stock right now"
            description="This shop has nothing available at the moment. Have a look at other shops in the meantime."
            action={
              <Link href="/" className={buttonStyles({ variant: "secondary" })}>
                Browse the marketplace
              </Link>
            }
          />
        ) : (
          <ProductGrid label="Products">
            {data.products.map((p) => (
              <ProductCard
                key={p.id}
                href={`/products/${p.id}`}
                title={p.title}
                imageUrl={p.coverImageId ? `/api/product-images/${encodeURIComponent(p.coverImageId)}` : null}
                priceMin={p.minPrice}
                priceMax={p.maxPrice}
              />
            ))}
          </ProductGrid>
        )}

        <Pagination page={data.page} totalPages={data.totalPages} hrefFor={(page) => href({ page })} className="pt-4" />
      </section>

      {shop.policies && (
        <section aria-labelledby="shop-policies" className="flex max-w-prose flex-col gap-2">
          <h2 id="shop-policies" className="text-xl font-semibold sm:text-2xl">
            Shop policies
          </h2>
          <p className="whitespace-pre-line text-muted">{shop.policies}</p>
        </section>
      )}
    </article>
  );
}

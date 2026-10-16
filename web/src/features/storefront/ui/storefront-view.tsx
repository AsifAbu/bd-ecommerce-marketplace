import Link from "next/link";
import { priceRange } from "@/features/products";
import { storefrontPath } from "@/lib/storefront-link";
import { isWebUrl } from "../metadata";
import { SORT_LABELS, SORTS, storefrontQueryString, type StorefrontQuery } from "../query";
import type { StorefrontData } from "../service";
import { ProductCover } from "./product-cover";
import { ShopScoreSlot } from "./shop-score-slot";

const linkClass = "text-blue-800 underline";
const inputClass =
  "rounded border border-gray-400 px-3 py-2 text-base focus:outline-2 focus:outline-offset-1 focus:outline-blue-700";
const buttonClass =
  "rounded bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700";

const memberSince = (d: Date) => d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Asia/Dhaka" });

/** US-014: one shop's public page. `data` comes from loadStorefront(). */
export function StorefrontView({ data }: { data: StorefrontData }) {
  const { shop } = data;
  const base = storefrontPath(shop.slug);
  const current: StorefrontQuery = { page: data.page, sort: data.sort, category: data.category?.slug ?? null };
  const href = (q: Partial<StorefrontQuery>) => `${base}${storefrontQueryString({ ...current, ...q })}`;

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        {isWebUrl(shop.bannerUrl) ? (
          // Shop-provided external URL; next/image would need every host allow-listed.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.bannerUrl} alt="" className="h-40 w-full rounded object-cover sm:h-56" />
        ) : (
          <div aria-hidden="true" className="h-24 w-full rounded bg-gradient-to-r from-blue-100 to-blue-50" />
        )}
        <div className="flex flex-wrap items-center gap-4">
          {isWebUrl(shop.logoUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shop.logoUrl} alt={`${shop.name} logo`} className="h-20 w-20 rounded-full border border-gray-300 object-cover" />
          )}
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold">{shop.name}</h1>
            <p className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
              {shop.tier === "verified" && (
                <span className="rounded-full bg-green-100 px-3 py-0.5 font-semibold text-green-900">✓ Verified seller</span>
              )}
              <span>Member since {memberSince(shop.createdAt)}</span>
            </p>
            <ShopScoreSlot shopId={shop.id} />
          </div>
        </div>
        {shop.description && <p className="whitespace-pre-line">{shop.description}</p>}
      </header>

      <section aria-labelledby="shop-products" className="flex flex-col gap-4">
        <h2 id="shop-products" className="text-2xl font-semibold">
          Products{data.category && ` in ${data.category.name}`} ({data.total})
        </h2>

        {data.categories.length > 0 && (
          <form action={base} method="get" className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-medium">Category</span>
              <select name="category" defaultValue={current.category ?? ""} className={inputClass}>
                <option value="">All categories</option>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name} ({c.count})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">Sort by</span>
              <select name="sort" defaultValue={current.sort} className={inputClass}>
                {SORTS.map((s) => (
                  <option key={s} value={s}>
                    {SORT_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={buttonClass}>
              Apply
            </button>
          </form>
        )}

        {data.products.length === 0 ? (
          <p>This shop has no products in stock right now.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {data.products.map((p) => (
              <li key={p.id}>
                <Link href={`/products/${p.id}`} className="flex flex-col gap-2 rounded border border-gray-200 p-2 hover:border-blue-700 focus:outline-2 focus:outline-blue-700">
                  <ProductCover imageId={p.coverImageId} title={p.title} />
                  <span className="font-medium">{p.title}</span>
                  <span className="text-gray-800">{priceRange([p.minPrice, p.maxPrice])}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {data.totalPages > 1 && (
          <nav aria-label="Pages" className="flex items-center gap-4">
            {data.page > 1 ? (
              <Link className={linkClass} href={href({ page: data.page - 1 })} rel="prev">
                Previous page
              </Link>
            ) : (
              <span aria-hidden="true" className="text-gray-400">Previous page</span>
            )}
            <span aria-current="page">
              Page {data.page} of {data.totalPages}
            </span>
            {data.page < data.totalPages ? (
              <Link className={linkClass} href={href({ page: data.page + 1 })} rel="next">
                Next page
              </Link>
            ) : (
              <span aria-hidden="true" className="text-gray-400">Next page</span>
            )}
          </nav>
        )}
      </section>

      {shop.policies && (
        <section aria-labelledby="shop-policies" className="flex flex-col gap-2">
          <h2 id="shop-policies" className="text-2xl font-semibold">
            Shop policies
          </h2>
          <p className="whitespace-pre-line">{shop.policies}</p>
        </section>
      )}
    </article>
  );
}

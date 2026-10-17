import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { VisibleCategory } from "../categories";
import { SearchError } from "../errors";
import { searchHref, SORT_LABELS, SORTS, toSearchParams, type RawParams, type SearchParams } from "../params";
import { searchService } from "../server";
import type { SearchItem, SearchResponse } from "../service";
import { AutoSubmit } from "./auto-submit";
import { FilterPanel } from "./filter-panel";
import { formatPriceRange } from "./format";
import { buttonClass, inputClass, linkClass, secondaryButtonClass } from "./styles";

/**
 * Search and category results (US-040 to US-043): search box, filter panel, sort, results grid
 * and pagination. `basePath` is /search or /c/<slug>; on a category page the category comes from
 * the path, not the query string.
 */

function ProductCard({ item }: { item: SearchItem }) {
  return (
    <li className="flex flex-col overflow-hidden rounded border border-gray-300">
      <Link href={item.url} className="flex flex-1 flex-col gap-1 p-3 hover:bg-gray-50 focus:outline-2 focus:outline-blue-700">
        <div className="mb-2 flex aspect-square items-center justify-center overflow-hidden rounded bg-gray-100">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed-URL redirect, not optimisable
            <img src={item.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
          ) : (
            <span className="text-sm text-gray-700">No image</span>
          )}
        </div>
        <h3 className="font-medium">{item.title}</h3>
        {item.bengaliName && (
          <p lang="bn" className="text-sm text-gray-700">
            {item.bengaliName}
          </p>
        )}
        <p className="font-semibold">{formatPriceRange(item.priceMin, item.priceMax)}</p>
        <p className="text-sm text-gray-700">{item.shopName}</p>
      </Link>
    </li>
  );
}

function Pagination({ response, href }: { response: SearchResponse; href: (page: number) => string }) {
  const { page, totalPages } = response;
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2 pt-2">
      {page > 1 ? (
        <Link className={secondaryButtonClass} href={href(page - 1)} rel="prev">
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link className={secondaryButtonClass} href={href(page + 1)} rel="next">
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function SortForm({ params, basePath, onCategoryPage }: { params: SearchParams; basePath: string; onCategoryPage: boolean }) {
  const keep = toSearchParams({ ...params, sort: "relevance", page: 1 }, { omitCategory: onCategoryPage });
  const formKey = toSearchParams(params, { omitCategory: onCategoryPage }).toString();
  return (
    <div key={formKey} className="contents">
      <Form id="search-sort" action={basePath} className="flex items-center gap-2 text-sm">
        {[...keep.entries()].map(([name, value], i) => (
          <input key={`${name}-${i}`} type="hidden" name={name} value={value} />
        ))}
        <label htmlFor="search-sort-select">Sort by</label>
        <select id="search-sort-select" name="sort" defaultValue={params.sort} className="rounded border border-gray-400 px-2 py-1">
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </select>
        <noscript>
          <button type="submit" className={secondaryButtonClass}>
            Sort
          </button>
        </noscript>
      </Form>
      <AutoSubmit formId="search-sort" />
    </div>
  );
}

function SearchBox({ params, basePath, onCategoryPage, label }: { params: SearchParams; basePath: string; onCategoryPage: boolean; label: string }) {
  return (
    <Form action={basePath} role="search" aria-label={label} className="flex gap-2">
      {params.category && !onCategoryPage && <input type="hidden" name="category" value={params.category} />}
      <label htmlFor="search-page-q" className="sr-only">
        {label}
      </label>
      <input
        id="search-page-q"
        name="q"
        type="search"
        defaultValue={params.q}
        maxLength={100}
        placeholder="e.g. processor, boi, শাড়ি"
        className={inputClass}
      />
      <button type="submit" className={buttonClass}>
        Search
      </button>
    </Form>
  );
}

export interface SearchResultsViewProps {
  basePath: string;
  raw: Record<string, string | string[] | undefined>;
  /** Category pages: breadcrumbs and subcategories from the visible tree. */
  trail?: VisibleCategory[];
  subcategories?: VisibleCategory[];
}

export async function SearchResultsView({ basePath, raw, trail, subcategories }: SearchResultsViewProps) {
  const onCategoryPage = basePath !== "/search";
  let response: SearchResponse;
  try {
    response = await searchService.search(raw as RawParams);
  } catch (err) {
    if (err instanceof SearchError && err.status === 404) notFound();
    if (err instanceof SearchError) {
      return (
        <div role="alert" className="flex flex-col gap-2 rounded border border-red-700 p-4">
          <p>{err.message}.</p>
          <Link className={linkClass} href={basePath}>
            Start a new search
          </Link>
        </div>
      );
    }
    throw err;
  }

  const { params, items, total } = response;
  const linkOptions = { omitCategory: onCategoryPage };
  const pageHref = (page: number) => searchHref(basePath, { ...params, page }, undefined, linkOptions);
  const heading = onCategoryPage
    ? (response.category?.name ?? "Category")
    : params.q
      ? `Results for “${params.q}”`
      : response.category
        ? response.category.name
        : "All products";

  return (
    <div className="flex flex-col gap-4">
      {trail && trail.length > 0 && (
        <nav aria-label="Breadcrumb" className="text-sm">
          <ol className="flex flex-wrap gap-1">
            <li>
              <Link className={linkClass} href="/categories">
                All categories
              </Link>
            </li>
            {trail.map((c, i) => (
              <li key={c.id} className="flex gap-1">
                <span aria-hidden="true">›</span>
                {i === trail.length - 1 ? (
                  <span aria-current="page">{c.name}</span>
                ) : (
                  <Link className={linkClass} href={`/c/${c.slug}`}>
                    {c.name}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <h1 className="text-2xl font-bold">{heading}</h1>
      <SearchBox
        params={params}
        basePath={basePath}
        onCategoryPage={onCategoryPage}
        label={onCategoryPage ? `Search in ${response.category?.name ?? "this category"}` : "Search products"}
      />
      {subcategories && subcategories.length > 0 && (
        <nav aria-label="Subcategories">
          <ul className="flex flex-wrap gap-2 text-sm">
            {subcategories.map((c) => (
              <li key={c.id}>
                <Link className="inline-block rounded-full border border-gray-400 px-3 py-1 hover:bg-gray-100" href={`/c/${c.slug}`}>
                  {c.name} <span className="text-gray-700">({c.count})</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="flex flex-col gap-6 md:flex-row">
        <FilterPanel response={response} basePath={basePath} onCategoryPage={onCategoryPage} />
        <section aria-labelledby="results-heading" className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="results-heading" className="font-semibold" aria-live="polite">
              {total === 1 ? "1 product" : `${total.toLocaleString("en-US")} products`}
            </h2>
            <SortForm params={params} basePath={basePath} onCategoryPage={onCategoryPage} />
          </div>
          {items.length === 0 ? (
            <div className="rounded border border-gray-300 p-4">
              <p>No products match{params.q ? ` “${params.q}”` : ""}. Try different words or fewer filters.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Products">
              {items.map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
            </ul>
          )}
          <Pagination response={response} href={pageHref} />
        </section>
      </div>
    </div>
  );
}

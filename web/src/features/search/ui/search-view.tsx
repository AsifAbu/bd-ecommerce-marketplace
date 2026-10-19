import { Search } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs, Button, buttonStyles, EmptyState, Input, Pagination, ProductCard, ProductGrid, ProductGridSkeleton, Select, Skeleton } from "@/components/ui";
import type { VisibleCategory } from "../categories";
import { SearchError } from "../errors";
import { hasFilters, searchHref, SORT_LABELS, SORTS, toSearchParams, type RawParams, type SearchParams } from "../params";
import { searchService } from "../server";
import type { SearchResponse } from "../service";
import { verifiedShopSlugs } from "../shop-tiers";
import { ActiveFilters, activeFilters } from "./active-filters";
import { AutoSubmit } from "./auto-submit";
import { FilterFields, hasPanel } from "./filter-panel";
import { FilterSheet } from "./filter-sheet";

/**
 * Search and category results (US-040 to US-043): search box, filter panel, sort, results grid
 * and pagination. `basePath` is /search or /c/<slug>; on a category page the category comes from
 * the path, not the query string.
 */

function SortForm({ params, basePath, onCategoryPage }: { params: SearchParams; basePath: string; onCategoryPage: boolean }) {
  const keep = toSearchParams({ ...params, sort: "relevance", page: 1 }, { omitCategory: onCategoryPage });
  const formKey = toSearchParams(params, { omitCategory: onCategoryPage }).toString();
  return (
    <div key={formKey} className="contents">
      <Form id="search-sort" action={basePath} className="flex flex-1 items-center gap-2 sm:flex-none">
        {[...keep.entries()].map(([name, value], i) => (
          <input key={`${name}-${i}`} type="hidden" name={name} value={value} />
        ))}
        <label htmlFor="search-sort-select" className="sr-only text-sm text-muted sm:not-sr-only">
          Sort by
        </label>
        <Select id="search-sort-select" name="sort" defaultValue={params.sort} className="min-w-0 flex-1 sm:w-auto sm:flex-none">
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </Select>
        <noscript>
          <Button type="submit" variant="secondary">
            Sort
          </Button>
        </noscript>
      </Form>
      <AutoSubmit formId="search-sort" />
    </div>
  );
}

function SearchBox({ params, basePath, onCategoryPage, label }: { params: SearchParams; basePath: string; onCategoryPage: boolean; label: string }) {
  return (
    <Form action={basePath} role="search" aria-label={label} className="flex max-w-xl gap-2">
      {params.category && !onCategoryPage && <input type="hidden" name="category" value={params.category} />}
      <label htmlFor="search-page-q" className="sr-only">
        {label}
      </label>
      <Input id="search-page-q" name="q" type="search" defaultValue={params.q} maxLength={100} placeholder="e.g. processor, boi, শাড়ি" className="min-w-0 flex-1" />
      <Button type="submit">
        <Search aria-hidden="true" size={18} />
        Search
      </Button>
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

/** Placeholder with the same footprint while results load. */
export function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status">
      <span className="sr-only">Loading results…</span>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-2/3 max-w-sm" />
        <Skeleton className="h-11 w-full max-w-xl" />
      </div>
      <div className="flex gap-10">
        <div className="hidden w-60 shrink-0 flex-col gap-4 lg:flex">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <ProductGridSkeleton count={8} dense />
        </div>
      </div>
    </div>
  );
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
        <div role="alert" className="flex flex-col gap-6">
          <h1 className="text-3xl font-semibold sm:text-4xl">Search</h1>
          <EmptyState
            title="That search could not be run"
            description={`${err.message}. Start a new search to see products again.`}
            action={
              <Link className={buttonStyles()} href={basePath}>
                Start a new search
              </Link>
            }
          />
        </div>
      );
    }
    throw err;
  }

  const { params, items, total } = response;
  const linkOptions = { omitCategory: onCategoryPage };
  const pageHref = (page: number) => searchHref(basePath, { ...params, page }, undefined, linkOptions);
  const clearHref = searchHref(
    basePath,
    params,
    (d) => ((d.attrs = {}), (d.priceMin = null), (d.priceMax = null), (d.shops = []), (d.minRating = null)),
    linkOptions,
  );
  const heading = onCategoryPage
    ? (response.category?.name ?? "Category")
    : params.q
      ? `Results for “${params.q}”`
      : response.category
        ? response.category.name
        : "All products";
  const chips = activeFilters(response, basePath, onCategoryPage);
  const showPanel = hasPanel(response);
  const verified = await verifiedShopSlugs(items.map((i) => i.shopSlug));
  const countText = total === 1 ? "1 product" : `${total.toLocaleString("en-US")} products`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {trail && trail.length > 0 && (
          <Breadcrumbs
            items={[
              { label: "All categories", href: "/categories" },
              ...trail.map((c, i) => ({ label: c.name, href: i === trail.length - 1 ? undefined : `/c/${c.slug}` })),
            ]}
          />
        )}
        <h1 className="text-3xl font-semibold sm:text-4xl">{heading}</h1>
      </div>
      <SearchBox
        params={params}
        basePath={basePath}
        onCategoryPage={onCategoryPage}
        label={onCategoryPage ? `Search in ${response.category?.name ?? "this category"}` : "Search products"}
      />
      {subcategories && subcategories.length > 0 && (
        <nav aria-label="Subcategories">
          <ul className="flex flex-wrap gap-2">
            {subcategories.map((c) => (
              <li key={c.id}>
                <Link
                  className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-md bg-surface px-3 text-sm font-medium hover:bg-line"
                  href={`/c/${c.slug}`}
                >
                  {c.name} <span className="font-normal text-muted">({c.count})</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="flex gap-10 lg:gap-12">
        {showPanel && (
          <aside aria-label="Filters" className="hidden w-60 shrink-0 lg:block">
            <FilterFields response={response} basePath={basePath} onCategoryPage={onCategoryPage} formId="search-filters" autoApply />
          </aside>
        )}
        <section aria-label="Results" className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="tabular text-sm text-muted" aria-live="polite">
              {countText}
            </p>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              {showPanel && (
                <FilterSheet active={chips.length}>
                  <FilterFields response={response} basePath={basePath} onCategoryPage={onCategoryPage} formId="search-filters-sheet" />
                </FilterSheet>
              )}
              <SortForm params={params} basePath={basePath} onCategoryPage={onCategoryPage} />
            </div>
          </div>
          <ActiveFilters filters={chips} clearHref={clearHref} />
          {items.length === 0 ? (
            <EmptyState
              title={params.q ? `No products match “${params.q}”` : "No products match these filters"}
              description="Try different words, or remove some filters."
              action={
                hasFilters(params) ? (
                  <Link className={buttonStyles()} href={clearHref}>
                    Clear all filters
                  </Link>
                ) : (
                  <Link className={buttonStyles()} href="/categories">
                    Browse categories
                  </Link>
                )
              }
            />
          ) : (
            <ProductGrid label="Products" dense={showPanel}>
              {items.map((item) => (
                <ProductCard
                  headingLevel={2}
                  key={item.id}
                  href={item.url}
                  title={item.title}
                  imageUrl={item.imageUrl}
                  categoryName={item.categoryName}
                  priceMin={item.priceMin}
                  priceMax={item.priceMax}
                  shopName={item.shopName}
                  shopVerified={verified.has(item.shopSlug)}
                  rating={item.rating}
                  ratingCount={item.ratingCount}
                />
              ))}
            </ProductGrid>
          )}
          <Pagination page={response.page} totalPages={response.totalPages} hrefFor={pageHref} className="pt-4" />
        </section>
      </div>
    </div>
  );
}

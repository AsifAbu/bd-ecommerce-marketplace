import { Star } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { Button, cn, Input } from "@/components/ui";
import { hasFilters, searchHref, toSearchParams, type SearchParams } from "../params";
import type { AttributeFacet, FacetOption, SearchFacets, SearchResponse } from "../service";
import { AutoSubmit } from "./auto-submit";
import { formatTk } from "./format";

/**
 * The filter panel (US-042): the leaf category's filterable attributes plus the common filters
 * (price, shop, rating), or for a search across categories only the common filters and
 * "Narrow by category". A plain GET form: the URL holds the whole state. The same fields render
 * in the desktop column (auto-submits) and in the mobile sheet (one "Apply filters" at the end).
 */

const legend = "text-sm font-semibold text-ink";
const group = "flex min-w-0 flex-col gap-1 border-0 p-0";
const row = "flex min-h-11 cursor-pointer items-center gap-3 rounded-md lg:min-h-9";
const box = "size-5 shrink-0 accent-jade";
const textLink = "inline-flex min-h-11 items-center rounded-sm text-jade underline-offset-4 hover:underline lg:min-h-9";

function Hidden({ params, onCategoryPage }: { params: SearchParams; onCategoryPage: boolean }) {
  return (
    <>
      {params.q && <input type="hidden" name="q" value={params.q} />}
      {params.category && !onCategoryPage && <input type="hidden" name="category" value={params.category} />}
      {params.sort !== "relevance" && <input type="hidden" name="sort" value={params.sort} />}
    </>
  );
}

function CheckboxList({ name, title, options }: { name: string; title: string; options: FacetOption[] }) {
  return (
    <fieldset className={group}>
      <legend className={cn(legend, "mb-1")}>{title}</legend>
      <ul className="flex max-h-72 flex-col overflow-y-auto">
        {options.map((o) => (
          <li key={o.value}>
            <label className={row}>
              <input type="checkbox" name={name} value={o.value} defaultChecked={o.selected} className={box} />
              <span>
                {o.label} <span className="text-muted">({o.count})</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function RangeInputs(props: {
  title: string;
  minName: string;
  maxName: string;
  min: number;
  max: number;
  selectedMin: number | null;
  selectedMax: number | null;
  format: (n: number) => string;
  idPrefix: string;
}) {
  // One value in the results: a range filter would offer nothing to choose.
  if (props.min === props.max && props.selectedMin === null && props.selectedMax === null) return null;
  const id = `${props.idPrefix}-${props.minName.replace(/\W/g, "-")}`;
  const field = (name: string, label: string, selected: number | null, placeholder: number) => (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
      <span>
        {label}
        <span className="sr-only"> {props.title}</span>
      </span>
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        name={name}
        defaultValue={selected ?? ""}
        placeholder={String(placeholder)}
        aria-describedby={`${id}-hint`}
        className="lg:min-h-10"
      />
    </label>
  );
  return (
    <fieldset className={group}>
      <legend className={cn(legend, "mb-1")}>{props.title}</legend>
      <p className="mb-1 text-sm text-muted" id={`${id}-hint`}>
        {props.format(props.min)} to {props.format(props.max)} in these results
      </p>
      <div className="flex items-end gap-2">
        {field(props.minName, "Min", props.selectedMin, props.min)}
        {field(props.maxName, "Max", props.selectedMax, props.max)}
      </div>
    </fieldset>
  );
}

/** US-055: "N stars & up" (one choice at a time) plus "Any rating". */
function RatingFilter({ facet }: { facet: NonNullable<SearchFacets["rating"]> }) {
  return (
    <fieldset className={group}>
      <legend className={cn(legend, "mb-1")}>Customer rating</legend>
      <ul className="flex flex-col">
        {facet.options.map((o) => (
          <li key={o.min}>
            <label className={row}>
              <input type="radio" name="rating" value={o.min} defaultChecked={o.selected} className={box} />
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={14} className={n <= o.min ? "fill-gold text-gold" : "text-edge/60"} />
                  ))}
                </span>
                <span>
                  {o.label} <span className="text-muted">({o.count})</span>
                </span>
              </span>
            </label>
          </li>
        ))}
        <li>
          <label className={row}>
            <input type="radio" name="rating" value="" defaultChecked={facet.selected === null} className={box} />
            <span>Any rating</span>
          </label>
        </li>
      </ul>
    </fieldset>
  );
}

function AttributeFilter({ facet, idPrefix }: { facet: AttributeFacet; idPrefix: string }) {
  const name = `f.${facet.key}`;
  switch (facet.widget) {
    case "checkbox_list":
      return <CheckboxList name={name} title={facet.name} options={facet.options} />;
    case "range_slider": {
      const unit = facet.unit ? ` ${facet.unit}` : "";
      return (
        <RangeInputs
          title={`${facet.name}${facet.unit ? ` (${facet.unit})` : ""}`}
          minName={`${name}.min`}
          maxName={`${name}.max`}
          min={facet.min}
          max={facet.max}
          selectedMin={facet.selectedMin}
          selectedMax={facet.selectedMax}
          format={(n) => `${n}${unit}`}
          idPrefix={idPrefix}
        />
      );
    }
    case "toggle":
      return (
        <div className={group}>
          <label className={row}>
            <input type="checkbox" name={name} value="1" defaultChecked={facet.selected} className={box} />
            <span>
              {facet.name} <span className="text-muted">({facet.count})</span>
            </span>
          </label>
        </div>
      );
  }
}

/** True when the panel has anything to show (so the column and the Filters button can be left out). */
export function hasPanel(response: SearchResponse): boolean {
  const { facets, mode, params } = response;
  return (
    hasFilters(params) ||
    facets.attributes.length > 0 ||
    facets.price !== null ||
    facets.shops.length > 0 ||
    facets.rating !== null ||
    (mode === "cross" && facets.categories.length > 0)
  );
}

export interface FilterFieldsProps {
  response: SearchResponse;
  basePath: string;
  onCategoryPage: boolean;
  /** Unique per rendering of the panel (the desktop column and the sheet both exist). */
  formId: string;
  /** Desktop column: ticking a box applies right away. The sheet applies once, with the button. */
  autoApply?: boolean;
}

export function FilterFields({ response, basePath, onCategoryPage, formId, autoApply = false }: FilterFieldsProps) {
  const { params, facets, mode } = response;
  const linkOptions = { omitCategory: onCategoryPage };
  // Remount the form when the URL changes so every control shows the URL's state.
  const formKey = toSearchParams(params, linkOptions).toString();
  const narrowHref = (slug: string) =>
    onCategoryPage
      ? searchHref(`/c/${slug}`, params, (d) => ((d.attrs = {}), (d.category = null)), { omitCategory: true })
      : searchHref(basePath, params, (d) => ((d.attrs = {}), (d.category = slug)));
  const clearHref = searchHref(
    basePath,
    params,
    (d) => ((d.attrs = {}), (d.priceMin = null), (d.priceMax = null), (d.shops = []), (d.minRating = null)),
    linkOptions,
  );

  return (
    <div className="flex flex-col gap-6 text-sm">
      {mode === "cross" && facets.categories.length > 0 && (
        <nav aria-label="Narrow by category" className="flex flex-col gap-1">
          <h2 className={legend}>Narrow by category</h2>
          <ul className="flex flex-col">
            {facets.categories.map((c) => (
              <li key={c.id}>
                <Link className={textLink} href={narrowHref(c.slug)}>
                  {c.name}
                </Link>{" "}
                <span className="text-muted">({c.count})</span>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {mode === "category" && !onCategoryPage && params.category && (
        <Link className={textLink} href={searchHref(basePath, params, (d) => ((d.attrs = {}), (d.category = null)))}>
          Search all categories
        </Link>
      )}
      {/* next/form ignores `key`, so the wrapper carries it. */}
      <div key={formKey} className="contents">
        <Form id={formId} action={basePath} className="flex flex-col gap-6">
          <Hidden params={params} onCategoryPage={onCategoryPage} />
          {facets.attributes.map((f) => (
            <AttributeFilter key={f.key} facet={f} idPrefix={formId} />
          ))}
          {facets.price && (
            <RangeInputs
              title="Price (Tk)"
              minName="price_min"
              maxName="price_max"
              min={facets.price.min}
              max={facets.price.max}
              selectedMin={facets.price.selectedMin}
              selectedMax={facets.price.selectedMax}
              format={formatTk}
              idPrefix={formId}
            />
          )}
          {facets.shops.length > 0 && <CheckboxList name="shop" title="Shop" options={facets.shops} />}
          {facets.rating && <RatingFilter facet={facets.rating} />}
          <div
            className={cn(
              "flex flex-wrap items-center gap-3",
              !autoApply && "sticky bottom-0 -mx-4 bg-paper px-4 pb-4 pt-3 shadow-[0_-1px_0_var(--color-line)]",
            )}
          >
            <Button type="submit" variant={autoApply ? "secondary" : "primary"} className={autoApply ? undefined : "flex-1"}>
              Apply filters
            </Button>
            {hasFilters(params) && !autoApply && (
              <Link className={textLink} href={clearHref}>
                Clear all filters
              </Link>
            )}
          </div>
        </Form>
        {autoApply && <AutoSubmit formId={formId} />}
      </div>
    </div>
  );
}

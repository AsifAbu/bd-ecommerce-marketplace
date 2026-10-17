import Form from "next/form";
import Link from "next/link";
import { hasFilters, searchHref, toSearchParams, type SearchParams } from "../params";
import type { AttributeFacet, FacetOption, SearchFacets, SearchResponse } from "../service";
import { AutoSubmit } from "./auto-submit";
import { formatTk } from "./format";
import { linkClass, secondaryButtonClass, smallInputClass } from "./styles";

/**
 * The filter panel (US-042): the leaf category's filterable attributes plus the common filters
 * (price, shop, rating), or for a search across categories only the common
 * filters and "Narrow by category". A plain GET form: the URL holds the whole state.
 */

const FORM_ID = "search-filters";
const legendClass = "font-semibold";
const fieldsetClass = "flex flex-col gap-1 border-t border-gray-300 pt-3";

function Hidden({ params, onCategoryPage }: { params: SearchParams; onCategoryPage: boolean }) {
  return (
    <>
      {params.q && <input type="hidden" name="q" value={params.q} />}
      {params.category && !onCategoryPage && <input type="hidden" name="category" value={params.category} />}
      {params.sort !== "relevance" && <input type="hidden" name="sort" value={params.sort} />}
    </>
  );
}

function CheckboxList({ name, legend, options }: { name: string; legend: string; options: FacetOption[] }) {
  return (
    <fieldset className={fieldsetClass}>
      <legend className={legendClass}>{legend}</legend>
      <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
        {options.map((o) => (
          <li key={o.value}>
            <label className="flex items-center gap-2">
              <input type="checkbox" name={name} value={o.value} defaultChecked={o.selected} className="h-4 w-4" />
              <span>
                {o.label} <span className="text-gray-700">({o.count})</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function RangeInputs(props: {
  legend: string;
  minName: string;
  maxName: string;
  min: number;
  max: number;
  selectedMin: number | null;
  selectedMax: number | null;
  format: (n: number) => string;
}) {
  const id = props.minName.replace(/\W/g, "-");
  return (
    <fieldset className={fieldsetClass}>
      <legend className={legendClass}>{props.legend}</legend>
      <p className="text-sm text-gray-700" id={`${id}-hint`}>
        {props.format(props.min)} to {props.format(props.max)} in these results
      </p>
      <div className="flex items-center gap-2">
        <label className="flex flex-1 flex-col text-sm">
          <span>
            Min<span className="sr-only"> {props.legend}</span>
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            name={props.minName}
            defaultValue={props.selectedMin ?? ""}
            placeholder={String(props.min)}
            aria-describedby={`${id}-hint`}
            className={smallInputClass}
          />
        </label>
        <label className="flex flex-1 flex-col text-sm">
          <span>
            Max<span className="sr-only"> {props.legend}</span>
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            name={props.maxName}
            defaultValue={props.selectedMax ?? ""}
            placeholder={String(props.max)}
            aria-describedby={`${id}-hint`}
            className={smallInputClass}
          />
        </label>
      </div>
    </fieldset>
  );
}

/** US-055: "N stars & up" (one choice at a time) plus "Any rating". */
function RatingFilter({ facet }: { facet: NonNullable<SearchFacets["rating"]> }) {
  return (
    <fieldset className={fieldsetClass}>
      <legend className={legendClass}>Customer rating</legend>
      <ul className="flex flex-col gap-1">
        {facet.options.map((o) => (
          <li key={o.min}>
            <label className="flex items-center gap-2">
              <input type="radio" name="rating" value={o.min} defaultChecked={o.selected} className="h-4 w-4" />
              <span>
                <span aria-hidden="true" className="text-amber-700">
                  {"★".repeat(o.min)}
                  <span className="text-gray-400">{"★".repeat(5 - o.min)}</span>
                </span>{" "}
                {o.label} <span className="text-gray-700">({o.count})</span>
              </span>
            </label>
          </li>
        ))}
        <li>
          <label className="flex items-center gap-2">
            <input type="radio" name="rating" value="" defaultChecked={facet.selected === null} className="h-4 w-4" />
            <span>Any rating</span>
          </label>
        </li>
      </ul>
    </fieldset>
  );
}

function AttributeFilter({ facet }: { facet: AttributeFacet }) {
  const name = `f.${facet.key}`;
  switch (facet.widget) {
    case "checkbox_list":
      return <CheckboxList name={name} legend={facet.name} options={facet.options} />;
    case "range_slider": {
      const unit = facet.unit ? ` ${facet.unit}` : "";
      return (
        <RangeInputs
          legend={`${facet.name}${facet.unit ? ` (${facet.unit})` : ""}`}
          minName={`${name}.min`}
          maxName={`${name}.max`}
          min={facet.min}
          max={facet.max}
          selectedMin={facet.selectedMin}
          selectedMax={facet.selectedMax}
          format={(n) => `${n}${unit}`}
        />
      );
    }
    case "toggle":
      return (
        <div className={fieldsetClass}>
          <label className="flex items-center gap-2">
            <input type="checkbox" name={name} value="1" defaultChecked={facet.selected} className="h-4 w-4" />
            <span>
              {facet.name} <span className="text-gray-700">({facet.count})</span>
            </span>
          </label>
        </div>
      );
  }
}

export function FilterPanel({ response, basePath, onCategoryPage }: { response: SearchResponse; basePath: string; onCategoryPage: boolean }) {
  const { params, facets, mode } = response;
  const linkOptions = { omitCategory: onCategoryPage };
  // Remount the form when the URL changes so every control shows the URL's state.
  const formKey = toSearchParams(params, linkOptions).toString();
  const narrowHref = (slug: string) =>
    onCategoryPage
      ? searchHref(`/c/${slug}`, params, (d) => ((d.attrs = {}), (d.category = null)), { omitCategory: true })
      : searchHref(basePath, params, (d) => ((d.attrs = {}), (d.category = slug)));

  return (
    <aside aria-label="Filters" className="flex flex-col gap-3 text-sm md:w-64 md:shrink-0">
      <h2 className="text-lg font-semibold">Filters</h2>
      {hasFilters(params) && (
        <Link
          className={linkClass}
          href={searchHref(basePath, params, (d) => ((d.attrs = {}), (d.priceMin = null), (d.priceMax = null), (d.shops = []), (d.minRating = null)), linkOptions)}
        >
          Clear all filters
        </Link>
      )}
      {mode === "cross" && facets.categories.length > 0 && (
        <nav aria-labelledby="narrow-heading" className="flex flex-col gap-1">
          <h3 id="narrow-heading" className={legendClass}>
            Narrow by category
          </h3>
          <ul className="flex flex-col gap-1">
            {facets.categories.map((c) => (
              <li key={c.id}>
                <Link className={linkClass} href={narrowHref(c.slug)}>
                  {c.name}
                </Link>{" "}
                <span className="text-gray-700">({c.count})</span>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {mode === "category" && !onCategoryPage && params.category && (
        <Link className={linkClass} href={searchHref(basePath, params, (d) => ((d.attrs = {}), (d.category = null)))}>
          Search all categories
        </Link>
      )}
      {/* next/form ignores `key`, so the wrapper carries it. */}
      <div key={formKey} className="contents">
        <Form id={FORM_ID} action={basePath} className="flex flex-col gap-3">
          <Hidden params={params} onCategoryPage={onCategoryPage} />
          {facets.attributes.map((f) => (
            <AttributeFilter key={f.key} facet={f} />
          ))}
          {facets.price && (
            <RangeInputs
              legend="Price (Tk)"
              minName="price_min"
              maxName="price_max"
              min={facets.price.min}
              max={facets.price.max}
              selectedMin={facets.price.selectedMin}
              selectedMax={facets.price.selectedMax}
              format={formatTk}
            />
          )}
          {facets.shops.length > 0 && <CheckboxList name="shop" legend="Shop" options={facets.shops} />}
          {facets.rating && <RatingFilter facet={facets.rating} />}
          <div className="border-t border-gray-300 pt-3">
            <button type="submit" className={secondaryButtonClass}>
              Apply filters
            </button>
          </div>
        </Form>
        <AutoSubmit formId={FORM_ID} />
      </div>
    </aside>
  );
}

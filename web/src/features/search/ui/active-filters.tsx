import { X } from "lucide-react";
import Link from "next/link";
import { searchHref, type SearchParams } from "../params";
import type { SearchResponse } from "../service";
import { formatTk } from "./format";

export interface ActiveFilter {
  key: string;
  label: string;
  /** The same search without this filter. */
  href: string;
}

const range = (min: number | null, max: number | null, fmt: (n: number) => string) =>
  min !== null && max !== null ? `${fmt(min)} to ${fmt(max)}` : min !== null ? `from ${fmt(min)}` : `up to ${fmt(max ?? 0)}`;

/** The filters in use, each with the link that removes it (the URL stays the single source of state). */
export function activeFilters(response: SearchResponse, basePath: string, onCategoryPage: boolean): ActiveFilter[] {
  const { params, facets } = response;
  const opts = { omitCategory: onCategoryPage };
  const without = (change: (d: SearchParams) => void) => searchHref(basePath, params, change, opts);
  const out: ActiveFilter[] = [];

  for (const f of facets.attributes) {
    if (f.widget === "checkbox_list") {
      for (const o of f.options.filter((x) => x.selected)) {
        out.push({
          key: `f.${f.key}.${o.value}`,
          label: `${f.name}: ${o.label}`,
          href: without((d) => {
            d.attrs[f.key].values = d.attrs[f.key].values.filter((v) => v !== o.value);
          }),
        });
      }
    } else if (f.widget === "range_slider" && (f.selectedMin !== null || f.selectedMax !== null)) {
      const unit = f.unit ? ` ${f.unit}` : "";
      out.push({
        key: `f.${f.key}.range`,
        label: `${f.name}: ${range(f.selectedMin, f.selectedMax, (n) => `${n}${unit}`)}`,
        href: without((d) => {
          d.attrs[f.key].min = null;
          d.attrs[f.key].max = null;
        }),
      });
    } else if (f.widget === "toggle" && f.selected) {
      out.push({
        key: `f.${f.key}`,
        label: f.name,
        href: without((d) => {
          delete d.attrs[f.key];
        }),
      });
    }
  }
  if (params.priceMin !== null || params.priceMax !== null) {
    out.push({
      key: "price",
      label: `Price: ${range(params.priceMin, params.priceMax, formatTk)}`,
      href: without((d) => ((d.priceMin = null), (d.priceMax = null))),
    });
  }
  for (const o of facets.shops.filter((x) => x.selected)) {
    out.push({ key: `shop.${o.value}`, label: `Shop: ${o.label}`, href: without((d) => (d.shops = d.shops.filter((s) => s !== o.value))) });
  }
  const rating = facets.rating?.options.find((o) => o.selected);
  if (rating) out.push({ key: "rating", label: rating.label, href: without((d) => (d.minRating = null)) });
  return out;
}

export function ActiveFilters({ filters, clearHref }: { filters: ActiveFilter[]; clearHref: string }) {
  if (filters.length === 0) return null;
  return (
    <nav aria-label="Active filters">
      <ul className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <li key={f.key}>
            <Link
              href={f.href}
              aria-label={`Remove filter ${f.label}`}
              className="pressable inline-flex min-h-11 items-center gap-2 rounded-md bg-surface pl-3 pr-2.5 text-sm hover:bg-line"
            >
              {f.label}
              <X aria-hidden="true" size={16} className="text-muted" />
            </Link>
          </li>
        ))}
        <li>
          <Link href={clearHref} className="inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-medium text-jade underline-offset-4 hover:underline">
            Clear all
          </Link>
        </li>
      </ul>
    </nav>
  );
}

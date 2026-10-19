"use client";

import { Fragment, useState, type ReactNode } from "react";
import { ChoiceChip, cn, Price } from "@/components/ui";
import type { AxisView, VariantView } from "../detail";
import { priceRange } from "../display";
import { findVariant, optionAvailable, optionStock, stockText, type Selection } from "../variant-picker";

/** At or below this many units a chip says "n left". */
const LOW_STOCK = 5;

/**
 * Price, variant picker and stock for the product page (US-044). The chosen variant is kept in
 * the URL (?variant=id, replaced without a navigation) so it can be shared and so the cart
 * and wishlist buttons (passed as `cart` and children) use the same variant. Out-of-stock
 * options are disabled. `extra` is a free slot beside the wishlist button (a future "Try on").
 */
export function PurchasePanel({
  axes,
  variants,
  initialVariantId,
  cart,
  extra,
  children,
}: {
  axes: AxisView[];
  variants: VariantView[];
  initialVariantId: string | null;
  /** The cart feature's "Add to cart" control. */
  cart?: ReactNode;
  /** Free action slot next to the wishlist button. Rendered only when given. */
  extra?: ReactNode;
  children?: ReactNode;
}) {
  const initial = variants.find((v) => v.id === initialVariantId);
  const [selected, setSelected] = useState<Selection>(initial ? { ...initial.options } : {});
  const variant = findVariant(variants, axes, selected);
  const stock = stockText(variant, axes, variants);
  const lowStock = variant !== null && variant.stock > 0 && variant.stock <= LOW_STOCK;

  function choose(axisKey: string, value: string) {
    const next = { ...selected, [axisKey]: value };
    setSelected(next);
    const match = findVariant(variants, axes, next);
    const params = new URLSearchParams(window.location.search);
    if (match) params.set("variant", match.id);
    else params.delete("variant");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <div aria-live="polite">
        {variant ? (
          <Price amount={variant.price} size="lg" />
        ) : (
          <p className="tabular text-2xl font-semibold text-ink">
            <span className="sr-only">Price: </span>
            {priceRange(variants.map((v) => v.price))}
          </p>
        )}
      </div>

      {axes.map((axis) => (
        <fieldset key={axis.key} className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-ink">{axis.name}</legend>
          <div className="flex flex-wrap gap-2">
            {axis.options.map((o) => {
              const available = optionAvailable(variants, axes, selected, axis.key, o.value);
              const units = optionStock(variants, axes, selected, axis.key, o.value);
              const descId = `opt-${axis.key}-${o.value}`.replace(/[^a-zA-Z0-9_-]/g, "_");
              return (
                <Fragment key={o.value}>
                  <ChoiceChip
                    name={`axis-${axis.key}`}
                    value={o.value}
                    checked={selected[axis.key] === o.value}
                    disabled={!available}
                    onChange={() => choose(axis.key, o.value)}
                    hint={available && units <= LOW_STOCK ? `${units} left` : undefined}
                    aria-describedby={descId}
                  >
                    {o.label}
                  </ChoiceChip>
                  <span id={descId} className="sr-only">
                    {available ? (units <= LOW_STOCK ? `${units} left` : "In stock") : "Out of stock"}
                  </span>
                </Fragment>
              );
            })}
          </div>
        </fieldset>
      ))}

      <p role="status" className={cn("text-sm", stock === "Out of stock" ? "font-medium text-vermilion" : lowStock ? "font-medium text-gold-ink" : "text-muted")}>
        {stock}
      </p>

      {cart}
      <div className="flex flex-wrap items-center gap-3 empty:hidden">
        {children}
        {extra && <div data-slot="product-actions-extra">{extra}</div>}
      </div>
    </div>
  );
}

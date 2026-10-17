"use client";

import { useState, type ReactNode } from "react";
import type { AxisView, VariantView } from "../detail";
import { formatTk, priceRange } from "../display";
import { findVariant, optionAvailable, stockText, type Selection } from "../variant-picker";

/**
 * Price, variant picker and stock for the product page (US-044). The chosen variant is kept in
 * the URL (?variant=id, replaced without a navigation) so it can be shared and so the cart
 * and wishlist buttons (passed as `cart` and children) use the same variant. Out-of-stock
 * options are disabled.
 */
export function PurchasePanel({
  axes,
  variants,
  initialVariantId,
  cart,
  children,
}: {
  axes: AxisView[];
  variants: VariantView[];
  initialVariantId: string | null;
  /** The cart feature's "Add to cart" control. */
  cart?: ReactNode;
  children?: ReactNode;
}) {
  const initial = variants.find((v) => v.id === initialVariantId);
  const [selected, setSelected] = useState<Selection>(initial ? { ...initial.options } : {});
  const variant = findVariant(variants, axes, selected);
  const stock = stockText(variant, axes, variants);

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
    <div className="flex flex-col gap-4">
      <p className="text-2xl font-bold" aria-live="polite">
        <span className="sr-only">Price: </span>
        {variant ? formatTk(variant.price) : priceRange(variants.map((v) => v.price))}
      </p>

      {axes.map((axis) => (
        <fieldset key={axis.key} className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">{axis.name}</legend>
          <div className="flex flex-wrap gap-2">
            {axis.options.map((o) => {
              const available = optionAvailable(variants, axes, selected, axis.key, o.value);
              const checked = selected[axis.key] === o.value;
              return (
                <label
                  key={o.value}
                  className={`flex items-center gap-2 rounded border px-3 py-1.5 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue-700 ${
                    checked ? "border-blue-700 bg-blue-50 font-semibold" : "border-gray-400"
                  } ${available ? "cursor-pointer" : "cursor-not-allowed text-gray-500 line-through"}`}
                >
                  <input
                    type="radio"
                    name={`axis-${axis.key}`}
                    value={o.value}
                    checked={checked}
                    disabled={!available}
                    onChange={() => choose(axis.key, o.value)}
                    className="accent-blue-700"
                  />
                  {o.label}
                  {!available && <span className="sr-only">(out of stock)</span>}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <p role="status" className={stock === "Out of stock" ? "font-semibold text-red-800" : "text-green-800"}>
        {stock}
      </p>

      {cart}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

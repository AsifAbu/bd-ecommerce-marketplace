import type { AxisView, VariantView } from "./detail";

/**
 * Variant picker rules for the product page (pure, used by the client panel). A selection maps
 * axis keys (size, colour...) to option values; a variant is found when every axis is chosen.
 */

export type Selection = Record<string, string>;

/** The variant matching a full selection, or null while an axis is still unchosen. */
export function findVariant(variants: VariantView[], axes: AxisView[], selected: Selection): VariantView | null {
  if (axes.length === 0) return variants.length === 1 ? variants[0] : null;
  if (axes.some((a) => selected[a.key] === undefined)) return null;
  return variants.find((v) => axes.every((a) => v.options[a.key] === selected[a.key])) ?? null;
}

/**
 * Whether an option can be picked: some in-stock variant has it and agrees with what is
 * chosen on the other axes. Out-of-stock and non-existent combinations are disabled.
 */
export function optionAvailable(
  variants: VariantView[],
  axes: AxisView[],
  selected: Selection,
  axisKey: string,
  value: string,
): boolean {
  return variants.some(
    (v) =>
      v.stock > 0 &&
      v.options[axisKey] === value &&
      axes.every((a) => a.key === axisKey || selected[a.key] === undefined || v.options[a.key] === selected[a.key]),
  );
}

/**
 * Units in stock behind an option, counting only variants that agree with what is chosen on the
 * other axes. Shown as "n left" on the chip when the stock is low.
 */
export function optionStock(variants: VariantView[], axes: AxisView[], selected: Selection, axisKey: string, value: string): number {
  return variants
    .filter((v) => v.options[axisKey] === value && axes.every((a) => a.key === axisKey || selected[a.key] === undefined || v.options[a.key] === selected[a.key]))
    .reduce((sum, v) => sum + Math.max(0, v.stock), 0);
}

/** Stock line under the price. */
export function stockText(variant: VariantView | null, axes: AxisView[], variants: VariantView[]): string {
  if (variant) return variant.stock > 0 ? `In stock: ${variant.stock} available` : "Out of stock";
  if (!variants.some((v) => v.stock > 0)) return "Out of stock";
  const names = axes.map((a) => a.name.toLowerCase());
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  return `Choose ${list} to see stock`;
}

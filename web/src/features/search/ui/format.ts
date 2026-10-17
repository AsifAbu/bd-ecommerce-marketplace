/** "Tk 1,850" (whole taka without decimals, paisa kept when present). */
export function formatTk(amount: number): string {
  return `Tk ${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** "Tk 1,850" or "Tk 1,850 – 1,950" for products whose variants differ in price. */
export function formatPriceRange(min: number, max: number): string {
  if (min === max) return formatTk(min);
  return `${formatTk(min)} – ${max.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

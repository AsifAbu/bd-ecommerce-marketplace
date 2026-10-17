/** Small display helpers for the seller pages (pure). */

interface CategoryNode {
  id: string;
  name: string;
  path: string;
  isLeaf: boolean;
  archivedAt: Date | null;
  requiresLicence: boolean;
}

export interface LeafChoice {
  id: string;
  label: string; // e.g. "Electronics › Computer Components › Processor"
  requiresLicence: boolean;
}

/** Leaf categories a shop can list in, labelled with their full path, sorted by it. */
export function leafChoices(categories: CategoryNode[], opts: { includeLicensed: boolean }): LeafChoice[] {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  return categories
    .filter((c) => c.isLeaf && !c.archivedAt && (opts.includeLicensed || !c.requiresLicence))
    .map((c) => ({
      id: c.id,
      label: c.path
        .split("/")
        .filter(Boolean)
        .map((id) => names.get(id) ?? "?")
        .join(" › "),
      requiresLicence: c.requiresLicence,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function formatTk(value: { toString(): string } | number | string): string {
  const n = Number(value.toString());
  return `Tk ${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** "Tk 1,850" or "Tk 1,200 – Tk 1,850". */
export function priceRange(prices: ({ toString(): string } | number | string)[]): string {
  if (prices.length === 0) return "—";
  const nums = prices.map((p) => Number(p.toString()));
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return min === max ? formatTk(min) : `${formatTk(min)} – ${formatTk(max)}`;
}

/** "Size: M, Colour: Black" from variant options and the axis fields. */
export function variantLabel(
  options: Record<string, unknown>,
  axes: { key: string; name: string; options: { value: string; label: string }[] }[],
): string {
  const parts = axes
    .filter((a) => options[a.key] !== undefined)
    .map((a) => `${a.name}: ${a.options.find((o) => o.value === options[a.key])?.label ?? String(options[a.key])}`);
  return parts.join(", ") || "Default";
}

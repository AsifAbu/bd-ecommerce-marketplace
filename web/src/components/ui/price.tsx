import { formatTk } from "@/lib/money";
import { cn } from "./cn";

export interface PriceProps {
  /** Current price in taka. With `min`/`max` it is ignored. */
  amount?: number;
  /** Original price before a discount. Shown struck through in muted when it is higher than `amount`. */
  original?: number | null;
  /** Price range for products whose variants differ ("Tk 1,850 – 1,950"). Equal values show one price. */
  min?: number;
  max?: number;
  /** sm (cards), md (default), lg (product page). */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = { sm: "text-sm", md: "text-base", lg: "text-2xl" } as const;

/**
 * A taka price with tabular numerals. A discounted price is vermilion, the original is struck
 * through in muted, and both are announced to screen readers in words ("Now ... was ...").
 */
export function Price({ amount, original, min, max, size = "md", className }: PriceProps) {
  const isRange = min !== undefined && max !== undefined && min !== max;
  const current = isRange ? min : (min ?? amount ?? 0);
  const onSale = !isRange && original != null && original > current;
  return (
    <p className={cn("tabular flex flex-wrap items-baseline gap-x-2 font-semibold", sizes[size], className)}>
      <span className={onSale ? "text-vermilion" : "text-ink"}>
        {onSale && <span className="sr-only">Now </span>}
        {isRange ? (
          <>
            {formatTk(min)} – {max!.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </>
        ) : (
          formatTk(current)
        )}
      </span>
      {onSale && (
        <s className="text-[0.85em] font-normal text-muted">
          <span className="sr-only">was </span>
          {formatTk(original)}
        </s>
      )}
    </p>
  );
}

/** Whole-number percentage off, or null when there is no discount: `discountPercent(1000, 800)` is 20. */
export function discountPercent(original: number, current: number): number | null {
  if (!(original > current) || original <= 0) return null;
  return Math.round(((original - current) / original) * 100);
}

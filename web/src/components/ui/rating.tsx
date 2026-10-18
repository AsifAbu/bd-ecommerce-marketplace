import { Star } from "lucide-react";
import { cn } from "./cn";

export interface RatingProps {
  /** Average from 0 to 5. Nothing is rendered when it is null/undefined, so "no reviews" never shows empty stars. */
  value: number | null | undefined;
  /** Number of reviews, shown in brackets. Nothing is rendered when it is 0. */
  count?: number;
  className?: string;
}

/** One gold star, the average and the review count: "★ 4.5 (12)". Renders only when data exists. */
export function Rating({ value, count, className }: RatingProps) {
  if (value == null || count === 0) return null;
  return (
    <p className={cn("tabular inline-flex items-center gap-1 text-sm text-ink", className)}>
      <Star aria-hidden="true" size={14} className="fill-gold text-gold" />
      <span className="sr-only">Rated </span>
      <span>{value.toFixed(1)}</span>
      <span className="sr-only"> out of 5</span>
      {count !== undefined && <span className="text-muted">({count})</span>}
    </p>
  );
}

import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "brand" | "sale" | "warning";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface text-ink",
  brand: "bg-jade-soft text-jade-hover",
  sale: "bg-vermilion-soft text-vermilion-hover",
  warning: "bg-gold/15 text-gold-ink",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** neutral (Out of stock), brand (Verified shop), sale (-20%), warning (Only 2 left). Default neutral. */
  tone?: BadgeTone;
}

/** A small status label. Sentence case, one to three words. Optionally put an icon (16px, aria-hidden) before the text. */
export function Badge({ tone = "neutral", className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium leading-4", tones[tone], className)}
      {...rest}
    />
  );
}

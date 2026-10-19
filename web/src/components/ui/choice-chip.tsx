import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface ChoiceChipProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> {
  /** The visible text. It is the radio's accessible name. */
  children: ReactNode;
  /** Small second line inside the chip (for example "2 left"). Hidden from assistive tech: describe it with aria-describedby. */
  hint?: string;
  className?: string;
}

/**
 * A radio styled as a chip (size, colour, delivery area). The real input covers the chip, so it
 * is native: keyboard arrows move within the group, a disabled option cannot be chosen. Give all
 * chips of a group the same `name` and put them in a <fieldset> with a <legend>.
 */
export function ChoiceChip({ children, hint, className, ...input }: ChoiceChipProps) {
  return (
    <label className={cn("relative inline-flex", className)}>
      <input type="radio" className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed" {...input} />
      <span
        className={cn(
          "pressable inline-flex min-h-11 min-w-11 flex-col items-center justify-center rounded-md border border-edge bg-paper px-3.5 text-base leading-5 text-ink",
          "peer-hover:bg-surface peer-checked:border-jade peer-checked:bg-jade-soft peer-checked:font-semibold peer-checked:text-jade-hover",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-jade",
          "peer-disabled:border-line peer-disabled:bg-paper peer-disabled:text-muted peer-disabled:line-through peer-disabled:hover:bg-paper",
        )}
      >
        <span>{children}</span>
        {hint && (
          <span aria-hidden="true" className="text-xs font-normal leading-4 text-muted no-underline">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

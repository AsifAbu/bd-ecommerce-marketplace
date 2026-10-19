import { Minus, Plus } from "lucide-react";
import { cn } from "./cn";

export interface QuantityStepperProps {
  /** Id of the number input; the visible or hidden label points at it. */
  id: string;
  /** Label text, e.g. "Quantity" or "Quantity of Blue shirt". */
  label: string;
  /** Hide the label visually (it stays for assistive tech). */
  hideLabel?: boolean;
  /** The typed value, as text so it can be empty while typing. */
  value: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  /** Text typed in the field. */
  onChange?: (value: string) => void;
  /** The + or - button was pressed: the new number (already within min and max). */
  onStep?: (next: number) => void;
  /** Enter pressed or focus left the field: the typed number. */
  onCommit?: (value: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  className?: string;
}

/**
 * A quantity control: minus button, number field, plus button, each 44px high. The number field is
 * a real spinbutton, so keyboard users can type or use the arrow keys. The caller decides what
 * happens on step and commit (the product page just updates state, the cart calls the server).
 */
export function QuantityStepper({
  id,
  label,
  hideLabel,
  value,
  min = 1,
  max,
  disabled,
  onChange,
  onStep,
  onCommit,
  decreaseLabel,
  increaseLabel,
  className,
}: QuantityStepperProps) {
  const current = Number(value);
  const valid = Number.isInteger(current);
  const step = (delta: number) => {
    const base = valid ? current : min;
    const next = Math.max(min, max !== undefined ? Math.min(max, base + delta) : base + delta);
    onStep?.(next);
  };
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-sm font-medium text-ink"}>
        {label}
      </label>
      <div className="inline-flex w-fit items-center rounded-md border border-edge bg-paper">
        <button
          type="button"
          aria-label={decreaseLabel}
          aria-controls={id}
          disabled={disabled || (valid && current <= min)}
          onClick={() => step(-1)}
          className="pressable inline-flex size-11 items-center justify-center rounded-l-md hover:bg-surface disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Minus aria-hidden="true" size={16} />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={() => onCommit?.(Number(value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommit?.(Number(value));
            }
          }}
          className="tabular h-11 w-12 border-0 bg-transparent p-0 text-center text-base [appearance:textfield] focus-visible:outline-offset-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label={increaseLabel}
          aria-controls={id}
          disabled={disabled || (max !== undefined && valid && current >= max)}
          onClick={() => step(1)}
          className="pressable inline-flex size-11 items-center justify-center rounded-r-md hover:bg-surface disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Plus aria-hidden="true" size={16} />
        </button>
      </div>
    </div>
  );
}

import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "pressable inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap select-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-jade text-paper hover:bg-jade-hover",
  secondary: "border border-edge bg-paper text-ink hover:bg-surface",
  ghost: "text-ink hover:bg-surface",
  danger: "bg-vermilion text-paper hover:bg-vermilion-hover",
};

// md and lg meet the 44px touch target; sm is 36px with a mouse and 44px on touch screens (dense desktop toolbars).
const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm max-lg:min-h-11 pointer-coarse:min-h-11",
  md: "min-h-11 px-4 text-base",
  lg: "min-h-12 px-6 text-base",
};

/**
 * Class names of a button, for styling a <Link> or <a> as a button:
 * `<Link href="/cart" className={buttonStyles({ variant: "secondary" })}>`.
 */
export function buttonStyles({
  variant = "primary",
  size = "md",
  block = false,
}: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean } = {}): string {
  return cn(base, variants[variant], sizes[size], block && "w-full");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: the one main action of a view. secondary: other actions. ghost: quiet, in toolbars. danger: destructive. Default primary. */
  variant?: ButtonVariant;
  /** sm 36px (dense desktop only), md 44px (default), lg 48px. */
  size?: ButtonSize;
  /** Full width. */
  block?: boolean;
  /** Shows a spinner, disables the button and sets aria-busy. Keep the label so the width does not jump. */
  loading?: boolean;
}

/** The standard button. `type` defaults to "button" (never submits by accident); pass type="submit" in forms. */
export function Button({ variant, size, block, loading = false, disabled, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonStyles({ variant, size, block }), className)}
      {...rest}
    >
      {loading && <span aria-hidden="true" className="spinner" />}
      {children}
    </button>
  );
}

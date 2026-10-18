import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  /** Required: the accessible name, e.g. "Close". There is no visible text. */
  label: string;
  /** The icon, e.g. `<X aria-hidden="true" size={20} />` from lucide-react. */
  icon: ReactNode;
  /** ghost (default) has no border; outline has a hairline edge. */
  variant?: "ghost" | "outline";
}

/** An icon-only button with a 44x44 touch target. Always give it a `label`. */
export function IconButton({ label, icon, variant = "ghost", className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "pressable inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink hover:bg-surface disabled:opacity-50",
        variant === "outline" && "border border-edge bg-paper",
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
}

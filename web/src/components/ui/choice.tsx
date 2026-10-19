import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** The visible label (clickable, linked to the input). */
  children: ReactNode;
};

const row = "flex min-h-11 cursor-pointer items-start gap-3 py-2 text-base";
const box = "mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-jade";

/** A checkbox with its label in a 44px touch row. Pass name, value, defaultChecked, required... as on <input>. */
export function Checkbox({ children, className, ...rest }: ChoiceProps) {
  return (
    <label className={cn(row, className)}>
      <input type="checkbox" className={box} {...rest} />
      <span>{children}</span>
    </label>
  );
}

/** A radio button with its label in a 44px touch row. Group them in a <fieldset> with a <legend>. */
export function Radio({ children, className, ...rest }: ChoiceProps) {
  return (
    <label className={cn(row, className)}>
      <input type="radio" className={box} {...rest} />
      <span>{children}</span>
    </label>
  );
}

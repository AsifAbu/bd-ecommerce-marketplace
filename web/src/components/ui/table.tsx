import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "./cn";

/**
 * A table that scrolls sideways inside its own box on narrow screens, so the page never overflows.
 * `label` names the scroll region (it is focusable so keyboard users can scroll it). Put a
 * <caption className="sr-only"> inside. For long lists on phones prefer cards and show the table from md.
 */
export function Table({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className={cn("max-w-full overflow-x-auto rounded-md border border-line", className)}>
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export const thStyles = "whitespace-nowrap border-b border-line bg-surface px-3 py-2.5 text-left text-xs font-semibold text-muted";
export const tdStyles = "border-b border-line px-3 py-3 align-top [tr:last-child_&]:border-b-0";

export function Th({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn(thStyles, className)} {...rest} />;
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn(tdStyles, className)} {...rest} />;
}

/** First cell of a row when the row has a name (reads as a row header). */
export function RowHeader({ className, children, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return (
    <th scope="row" className={cn(tdStyles, "font-medium", className)} {...rest}>
      {children}
    </th>
  );
}

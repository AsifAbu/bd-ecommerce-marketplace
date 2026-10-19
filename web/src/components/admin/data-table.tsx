import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/components/ui";

/*
 * Admin data tables, an additive layer next to the kit's <Table>: a caption prop, <Thead>/<Tbody>/<Tr>,
 * labelled cells and an optional "stack on phones" mode. The kit's <Table> is unchanged and still
 * used by the seller and account pages.
 */

export interface DataTableProps {
  /** Names the table for assistive tech (a visually hidden <caption>). Required. */
  caption: string;
  /** Under 640px each row becomes a labelled block (give every <Td> a `label`). Default: scrolls inside its own frame. */
  stack?: boolean;
  className?: string;
  children: ReactNode;
}

export function Table({ caption, stack = false, className, children }: DataTableProps) {
  const table = (
    <table className={cn("w-full border-collapse text-left text-sm", stack && "table-stack", className)}>
      <caption className="sr-only">{caption}</caption>
      {children}
    </table>
  );
  if (stack) return <div className="overflow-hidden rounded-lg border border-line sm:overflow-x-auto">{table}</div>;
  return (
    <div role="region" aria-label={caption} tabIndex={0} className="max-w-full overflow-x-auto rounded-lg border border-line">
      {table}
    </div>
  );
}

export function Thead({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-surface text-muted", className)} {...rest} />;
}

export function Tbody({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&>tr]:border-t [&>tr]:border-line first:[&>tr]:border-t-0", className)} {...rest} />;
}

/** A row. `flag` tints rows that need attention (overdue); the reason must also be in words inside the row. */
export function Tr({ flag = false, className, ...rest }: HTMLAttributes<HTMLTableRowElement> & { flag?: boolean }) {
  return <tr className={cn("flash-result", flag && "bg-vermilion-soft/50", className)} {...rest} />;
}

export function Th({ scope = "col", align = "left", className, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" }) {
  return (
    <th
      scope={scope}
      className={cn(
        "px-3 py-2.5 align-top font-medium",
        scope === "col" && "whitespace-nowrap text-muted",
        scope === "row" && "font-semibold text-ink",
        align === "right" && "tabular text-right",
        className,
      )}
      {...rest}
    />
  );
}

export function Td({
  align = "left",
  label,
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "right";
  /** Column name shown above the value when the table is stacked on phones. */
  label?: string;
}) {
  return <td data-label={label} className={cn("px-3 py-3 align-top", align === "right" && "tabular text-right", className)} {...rest} />;
}

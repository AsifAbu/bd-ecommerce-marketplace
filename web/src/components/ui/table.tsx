import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "./cn";

export interface TableProps {
  /** Names the table for assistive tech (rendered as a visually hidden <caption>). Required. */
  caption: string;
  /**
   * Stack each row into a labelled block under 640px (give every <Td> a `label`). Default: the table
   * scrolls sideways inside its own frame, never the page.
   */
  stack?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * A data table in a hairline frame. Put <Thead>/<Tbody> as children; use <Th> and <Td>.
 * Wide tables scroll inside the frame (focusable, so keyboard users can scroll it).
 */
export function Table({ caption, stack = false, className, children }: TableProps) {
  const table = (
    <table className={cn("w-full border-collapse text-left text-sm", stack && "table-stack", className)}>
      <caption className="sr-only">{caption}</caption>
      {children}
    </table>
  );
  if (stack) return <div className="overflow-hidden rounded-lg border border-line sm:overflow-x-auto">{table}</div>;
  return (
    <div role="region" aria-label={caption} tabIndex={0} className="overflow-x-auto rounded-lg border border-line">
      {table}
    </div>
  );
}

/** Header row: quiet surface background so the rows read as the content. */
export function Thead({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-surface text-muted", className)} {...rest} />;
}

export function Tbody({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&>tr]:border-t [&>tr]:border-line first:[&>tr]:border-t-0", className)} {...rest} />;
}

/** A row. `flag` marks rows that need attention (overdue): a vermilion tint, with the reason in words inside the row. */
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
        align === "right" && "text-right tabular",
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
  return <td data-label={label} className={cn("px-3 py-3 align-top", align === "right" && "text-right tabular", className)} {...rest} />;
}

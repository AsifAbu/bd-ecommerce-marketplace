import type { HTMLAttributes } from "react";
import { cn } from "./cn";

/** A grey loading block. Set size with classes: `<Skeleton className="h-4 w-24" />`. Hidden from screen readers; put a visible/sr-only "Loading" label on the container. */
export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-sm bg-surface", className)} {...rest} />;
}

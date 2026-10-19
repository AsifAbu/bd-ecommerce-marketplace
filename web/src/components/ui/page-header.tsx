import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

/** The page's one <h1>, with an optional line under it and actions on the right (stacked on phones). */
export function PageHeader({
  title,
  description,
  actions,
  className,
  ...rest
}: { title: string; description?: ReactNode; actions?: ReactNode } & Omit<HTMLAttributes<HTMLElement>, "title">) {
  return (
    <header className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6", className)} {...rest}>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {description && <div className="max-w-prose text-muted">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

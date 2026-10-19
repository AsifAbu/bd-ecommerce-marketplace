import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "@/components/ui";

/**
 * The top of an admin page: the one h1, a short description and, on the right, the page's primary
 * action (a Button or a link styled with buttonStyles). Pass `crumbs` on detail pages.
 */
export function AdminPageHeader({
  title,
  description,
  action,
  crumbs,
  children,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  crumbs?: Crumb[];
  /** Extra line under the description, e.g. a status chip row. */
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 max-w-prose flex-col gap-1">
          <h1 className="text-3xl font-semibold">{title}</h1>
          {description && <div className="text-muted">{description}</div>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </header>
  );
}

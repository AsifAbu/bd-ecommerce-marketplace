import type { ReactNode } from "react";
import { cn } from "./cn";

export interface EmptyStateProps {
  /** What is empty, in plain words: "Your cart is empty". */
  title: string;
  /** One sentence saying what to do next. */
  description?: string;
  /** The next step: a Button or a link styled with buttonStyles(). */
  action?: ReactNode;
  /** Optional line icon (lucide, 24px, aria-hidden). */
  icon?: ReactNode;
  className?: string;
}

/** An empty list or no-results message that invites an action. Left-aligned, no illustration. */
export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-start gap-3 rounded-lg bg-surface p-6 sm:p-8", className)}>
      {icon && <div className="text-muted">{icon}</div>}
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="max-w-prose text-muted">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

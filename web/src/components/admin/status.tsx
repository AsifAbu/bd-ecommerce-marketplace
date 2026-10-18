import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui";

/**
 * One tone per meaning across the admin, so a status looks the same on every list. The words
 * always carry the meaning; the tone only helps scanning.
 *   brand   = done or healthy (approved, delivered, paid, resolved, current)
 *   warning = waiting for someone (pending, requested, open, draft, scheduled)
 *   sale    = problem or stopped (overdue, rejected, suspended, cancelled, refused, hidden, escalated)
 *   neutral = everything else (closed, superseded, returned)
 */
const TONES: Record<string, BadgeTone> = {
  approved: "brand",
  active: "brand",
  verified: "brand",
  delivered: "brand",
  refunded: "brand",
  received: "brand",
  paid: "brand",
  resolved: "brand",
  visible: "brand",
  current: "brand",
  met: "brand",
  confirmed: "brand",
  packed: "brand",
  handed_over: "brand",
  accepted: "brand",
  in_progress: "brand",

  pending: "warning",
  requested: "warning",
  open: "warning",
  placed: "warning",
  draft: "warning",
  scheduled: "warning",
  due_soon: "warning",

  overdue: "sale",
  rejected: "sale",
  suspended: "sale",
  cancelled: "sale",
  refused: "sale",
  hidden: "sale",
  escalated: "sale",
  denied: "sale",
  not_met: "sale",
  expired: "sale",
};

export function statusTone(status: string): BadgeTone {
  return TONES[status] ?? "neutral";
}

/** A status label. `status` picks the tone; `children` is the words shown (default: the status). */
export function StatusBadge({ status, children, ...rest }: { status: string; children?: ReactNode } & Record<`data-${string}`, string>) {
  return (
    <Badge tone={statusTone(status)} {...rest}>
      {children ?? status}
    </Badge>
  );
}

/** "Overdue" in words and vermilion, used the same way on every list. */
export function OverdueFlag({ children = "Overdue", ...rest }: { children?: ReactNode } & Record<`data-${string}`, string>) {
  return (
    <Badge tone="sale" {...rest}>
      {children}
    </Badge>
  );
}

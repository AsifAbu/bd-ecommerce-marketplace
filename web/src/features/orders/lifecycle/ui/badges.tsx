import { Badge, statusTone } from "@/components/ui";
import type { ShopOrderStatus } from "../../config";
import { formatDhakaTime } from "../../views";
import type { ShopOrderListView } from "../views";
import { HandoverCountdown } from "./countdown";

/** A shop order's status: amber while it waits on the shop, jade when delivered, vermilion when refused, grey when closed. */
export function StatusBadge({ status, label }: { status: ShopOrderStatus; label: string }) {
  return (
    <Badge tone={statusTone(status)} data-testid="shop-order-status">
      {label}
    </Badge>
  );
}

export function OverdueBadge() {
  return (
    <Badge tone="sale" data-testid="overdue-badge">
      Overdue
    </Badge>
  );
}

/** Deadline line: countdown while the timer runs, or when it was handed over (on time or late). */
export function HandoverDeadline({ so }: { so: ShopOrderListView }) {
  if (so.countdown.label && so.countdown.state) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 text-sm">
        <span className="text-muted">Hand over by {formatDhakaTime(so.handoverDueAt)}:</span>
        <HandoverCountdown status={so.status} dueAt={so.handoverDueAt} initialLabel={so.countdown.label} initialState={so.countdown.state} />
      </p>
    );
  }
  if (so.handedOverAt) {
    return (
      <p className="text-sm text-muted">
        Handed over {formatDhakaTime(so.handedOverAt)}
        {so.handedOverLate ? <strong className="font-semibold text-vermilion"> (after the 48 h deadline)</strong> : " (within 48 h)"}
      </p>
    );
  }
  return null;
}

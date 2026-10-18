import { statusTone } from "@/components/admin/status";
import { Badge } from "@/components/ui";
import type { ShopOrderStatus } from "../../config";
import { formatDhakaTime } from "../../views";
import type { ShopOrderListView } from "../views";
import { HandoverCountdown } from "./countdown";

/** Shop order status as a kit badge; the tone follows the shared admin status tones. */
export function StatusBadge({ status, label }: { status: ShopOrderStatus; label: string }) {
  return (
    <Badge tone={statusTone(status)} className="text-sm" data-testid="shop-order-status">
      {label}
    </Badge>
  );
}

export function OverdueBadge() {
  return (
    <Badge tone="sale" className="text-sm" data-testid="overdue-badge">
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
      <p className="text-sm">
        Handed over {formatDhakaTime(so.handedOverAt)}
        {so.handedOverLate ? <strong className="text-vermilion"> (after the 48 h deadline)</strong> : " (within 48 h)"}
      </p>
    );
  }
  return null;
}

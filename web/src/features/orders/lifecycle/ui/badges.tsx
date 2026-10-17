import type { ShopOrderStatus } from "../../config";
import { formatDhakaTime } from "../../views";
import type { ShopOrderListView } from "../views";
import { HandoverCountdown } from "./countdown";

const TONES: Record<ShopOrderStatus, string> = {
  placed: "bg-amber-100 text-amber-950",
  confirmed: "bg-blue-100 text-blue-950",
  packed: "bg-blue-100 text-blue-950",
  handed_over: "bg-indigo-100 text-indigo-950",
  delivered: "bg-green-100 text-green-950",
  cancelled: "bg-gray-200 text-gray-900",
  refused: "bg-red-100 text-red-950",
  returned: "bg-gray-200 text-gray-900",
};

export function StatusBadge({ status, label }: { status: ShopOrderStatus; label: string }) {
  return (
    <span className={`rounded px-2 py-0.5 text-sm font-semibold ${TONES[status] ?? "bg-gray-100"}`} data-testid="shop-order-status">
      {label}
    </span>
  );
}

export function OverdueBadge() {
  return (
    <span className="rounded bg-red-700 px-2 py-0.5 text-sm font-bold text-white" data-testid="overdue-badge">
      Overdue
    </span>
  );
}

/** Deadline line: countdown while the timer runs, or when it was handed over (on time or late). */
export function HandoverDeadline({ so }: { so: ShopOrderListView }) {
  if (so.countdown.label && so.countdown.state) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span>Hand over by {formatDhakaTime(so.handoverDueAt)}:</span>
        <HandoverCountdown status={so.status} dueAt={so.handoverDueAt} initialLabel={so.countdown.label} initialState={so.countdown.state} />
      </p>
    );
  }
  if (so.handedOverAt) {
    return (
      <p className="text-sm">
        Handed over {formatDhakaTime(so.handedOverAt)}
        {so.handedOverLate ? <strong className="text-red-800"> (after the 48 h deadline)</strong> : " (within 48 h)"}
      </p>
    );
  }
  return null;
}

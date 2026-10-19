import { formatDhakaTime } from "../views";
import type { TimelineEntry } from "../lifecycle/timeline";

/**
 * A shop order's progress for the customer: a vertical line with a filled dot for each step that
 * happened (with its time, reason or courier) and hollow dots for the steps still to come.
 */
export function StatusTimeline({ entries, label }: { entries: TimelineEntry[]; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-col text-sm">
      {entries.map((e, i) => {
        const last = i === entries.length - 1;
        return (
          <li key={i} className="relative pb-4 pl-7 last:pb-0">
            {!last && <span aria-hidden="true" className={`absolute left-[5px] top-4 h-[calc(100%-0.5rem)] w-px ${entries[i + 1].done ? "bg-jade" : "bg-line"}`} />}
            <span
              aria-hidden="true"
              className={`absolute left-0 top-1.5 size-[11px] rounded-full border-2 ${e.done ? "border-jade bg-jade" : "border-edge bg-paper"}`}
            />
            <p className={e.done ? "font-medium text-ink" : "text-muted"}>
              {e.label}
              {!e.done && <span className="sr-only"> (next)</span>}
            </p>
            {e.at && <p className="tabular text-muted">{formatDhakaTime(e.at)}</p>}
            {e.note && <p className="text-ink">{e.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}

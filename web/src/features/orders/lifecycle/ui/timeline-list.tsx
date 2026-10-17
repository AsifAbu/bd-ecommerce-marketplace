import { formatDhakaTime } from "../../views";
import type { TimelineEntry } from "../timeline";

/** A shop order's steps: done ones with their time (and reason or courier), then the next ones. */
export function TimelineList({ entries, label }: { entries: TimelineEntry[]; label: string }) {
  return (
    <ol className="flex flex-col gap-1 border-l-2 border-gray-300 pl-4 text-sm" aria-label={label}>
      {entries.map((e, i) => (
        <li key={i} className={e.done ? "" : "text-gray-700"}>
          <span className={e.done ? "font-semibold" : ""}>{e.label}</span>
          {e.at ? <span> · {formatDhakaTime(e.at)}</span> : <span> · next</span>}
          {e.note && <span className="block text-gray-800">{e.note}</span>}
        </li>
      ))}
    </ol>
  );
}

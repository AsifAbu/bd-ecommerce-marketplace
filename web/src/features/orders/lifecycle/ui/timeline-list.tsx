import { cn } from "@/components/ui";
import { formatDhakaTime } from "../../views";
import type { TimelineEntry } from "../timeline";

/** A shop order's steps: done ones with their time (and reason or courier), then the next ones. */
export function TimelineList({ entries, label }: { entries: TimelineEntry[]; label: string }) {
  return (
    <ol className="flex flex-col" aria-label={label}>
      {entries.map((e, i) => (
        <li key={i} className="flex gap-3 py-1.5">
          <span aria-hidden="true" className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", e.done ? "bg-jade" : "bg-edge/50")} />
          <span className={cn("min-w-0", !e.done && "text-muted")}>
            <span className={e.done ? "font-medium" : ""}>{e.label}</span>
            {e.at ? <span className="text-muted">, {formatDhakaTime(e.at)}</span> : <span>, next</span>}
            {e.note && <span className="block text-sm text-muted">{e.note}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

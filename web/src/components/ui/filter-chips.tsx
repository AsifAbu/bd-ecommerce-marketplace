import Link from "next/link";
import { cn } from "./cn";

export interface ChipItem {
  label: string;
  href: string;
  current?: boolean;
  /** Optional count shown after the label. */
  count?: number;
}

/**
 * Filters or views as a row of links (server-rendered, work without JavaScript). The current one
 * has aria-current="page" and an ink fill, so it is clear without relying on colour alone.
 */
export function FilterChips({ label, items, className }: { label: string; items: ChipItem[]; className?: string }) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="flex flex-wrap gap-2">
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              aria-current={it.current ? "page" : undefined}
              className={cn(
                "pressable inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-medium sm:min-h-9",
                it.current ? "border-ink bg-ink text-paper" : "border-edge bg-paper text-ink hover:bg-surface",
              )}
            >
              {it.label}
              {it.count !== undefined && <span className="tabular opacity-80">{it.count}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

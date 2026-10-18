"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "./cn";

export interface DisclosureMenuProps {
  /** Content of the clickable summary (text, icons). */
  summary: ReactNode;
  /** Accessible name of the summary when its content is only an icon or avatar. */
  summaryLabel?: string;
  summaryClassName?: string;
  /** The floating panel (links). Server-rendered children are fine. */
  children: ReactNode;
  panelClassName?: string;
  className?: string;
}

/**
 * A navigation menu built on native <details>/<summary>: it opens and closes without JavaScript,
 * and with JavaScript it also closes on Escape, on an outside click and when a link inside is
 * followed. The panel is positioned under the summary (right-aligned by default via panelClassName).
 */
export function DisclosureMenu({ summary, summaryLabel, summaryClassName, children, panelClassName, className }: DisclosureMenuProps) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const close = () => el.removeAttribute("open");
    const onPointer = (e: PointerEvent) => {
      if (el.open && !el.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && el.open) {
        close();
        el.querySelector("summary")?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("a[href]")) close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    el.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      el.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <details ref={ref} className={cn("group relative", className)}>
      <summary
        aria-label={summaryLabel}
        className={cn(
          "pressable flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-3 text-sm font-medium hover:bg-surface [&::-webkit-details-marker]:hidden",
          summaryClassName,
        )}
      >
        {summary}
      </summary>
      <div
        className={cn(
          "details-panel absolute right-0 top-full z-30 mt-1 max-h-[80dvh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-line bg-paper p-1 shadow-md",
          panelClassName,
        )}
      >
        {children}
      </div>
    </details>
  );
}

/** Class for a row (link) inside a DisclosureMenu panel. */
export const menuItemStyles =
  "flex min-h-11 items-center justify-between gap-2 rounded-sm px-3 py-2 text-sm hover:bg-surface";

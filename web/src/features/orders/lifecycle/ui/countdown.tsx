"use client";

import { useEffect, useState } from "react";
import { handoverCountdown } from "../handover";

/**
 * Live countdown to the 48 h handover deadline. The first render shows the server's label (no
 * hydration mismatch); it then refreshes every 30 seconds in the browser.
 */
export function HandoverCountdown({ status, dueAt, initialLabel, initialState }: { status: string; dueAt: string; initialLabel: string; initialState: string }) {
  const [view, setView] = useState({ label: initialLabel, state: initialState });
  useEffect(() => {
    const tick = () => {
      const c = handoverCountdown(status, new Date(dueAt), new Date());
      if (c.label && c.state) setView({ label: c.label, state: c.state });
    };
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [status, dueAt]);
  const tone = view.state === "overdue" ? "text-red-800" : view.state === "due_soon" ? "text-amber-900" : "text-gray-800";
  return (
    <span className={`text-sm font-semibold ${tone}`} data-testid="handover-countdown">
      {view.label}
    </span>
  );
}

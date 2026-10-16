"use client";

import { useState } from "react";

/** Copies a link to the clipboard and says so to screen readers. */
export function CopyLinkButton({ value, label = "Copy link" }: { value: string; label?: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={copy}
        className="rounded border border-gray-500 px-3 py-1 font-medium hover:bg-gray-100 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700"
      >
        {label}
      </button>
      <span role="status" className="text-sm">
        {status === "copied" ? "Link copied" : status === "failed" ? "Copy failed: select the link and copy it" : ""}
      </span>
    </span>
  );
}

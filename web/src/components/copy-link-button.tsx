"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

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
      <Button variant="secondary" onClick={copy}>
        {label}
      </Button>
      <span role="status" className="text-sm text-muted">
        {status === "copied" ? "Link copied" : status === "failed" ? "Copy failed: select the link and copy it" : ""}
      </span>
    </span>
  );
}

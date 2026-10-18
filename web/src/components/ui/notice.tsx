import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type NoticeTone = "success" | "error" | "warning" | "info";

const tones: Record<NoticeTone, string> = {
  success: "bg-jade-soft text-jade-hover",
  error: "bg-vermilion-soft text-vermilion-hover",
  warning: "bg-gold/15 text-gold-ink",
  info: "bg-surface text-ink",
};

export interface NoticeProps extends HTMLAttributes<HTMLDivElement> {
  /** success (saved), error (could not do it), warning (needs attention), info (neutral). Default info. */
  tone?: NoticeTone;
}

/**
 * A short message block on a quiet tinted background. Errors default to role="alert", everything
 * else to role="status", so it is announced when it appears. It eases in (CSS, off with reduced motion).
 */
export function Notice({ tone = "info", role, className, ...rest }: NoticeProps) {
  return (
    <div
      role={role ?? (tone === "error" ? "alert" : "status")}
      className={cn("toast-in rounded-md px-3 py-2.5 text-sm font-medium", tones[tone], className)}
      {...rest}
    />
  );
}

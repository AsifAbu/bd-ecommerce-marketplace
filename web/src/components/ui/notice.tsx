import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type NoticeTone = "info" | "success" | "warning" | "error";

const tones: Record<NoticeTone, string> = {
  info: "bg-surface text-ink",
  success: "bg-jade-soft text-jade-hover",
  warning: "bg-gold/15 text-gold-ink",
  error: "bg-vermilion-soft text-vermilion-hover",
};

const icons: Record<NoticeTone, ReactNode> = {
  info: <Info aria-hidden="true" size={18} />,
  success: <CircleCheck aria-hidden="true" size={18} />,
  warning: <TriangleAlert aria-hidden="true" size={18} />,
  error: <CircleAlert aria-hidden="true" size={18} />,
};

export interface NoticeProps extends HTMLAttributes<HTMLDivElement> {
  /** info (neutral), success, warning (price changed, something to check), error (what to fix). Default info. */
  tone?: NoticeTone;
  /** Hide the leading icon. */
  plain?: boolean;
}

/**
 * A short message in a quiet tinted panel, from palette tokens only. Errors default to role="alert",
 * everything else to role="status". Say what happened and what to do next.
 */
export function Notice({ tone = "info", plain = false, role, className, children, ...rest }: NoticeProps) {
  return (
    <div
      role={role ?? (tone === "error" ? "alert" : "status")}
      className={cn("flex items-start gap-2.5 rounded-md px-3 py-2.5 text-sm", tones[tone], className)}
      {...rest}
    >
      {!plain && <span className="mt-0.5 shrink-0">{icons[tone]}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

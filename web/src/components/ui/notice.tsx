import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type NoticeTone = "info" | "success" | "warning" | "danger";

const tones: Record<NoticeTone, { box: string; icon: typeof Info }> = {
  info: { box: "bg-surface text-ink", icon: Info },
  success: { box: "bg-jade-soft text-jade-hover", icon: CircleCheck },
  warning: { box: "bg-gold/15 text-gold-ink", icon: TriangleAlert },
  danger: { box: "bg-vermilion-soft text-vermilion-hover", icon: CircleAlert },
};

export interface NoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: NoticeTone;
  /** Short bold lead-in. */
  title?: string;
  children?: ReactNode;
}

/**
 * A quiet message block with an icon: the tone is also stated by the icon shape and the words, never
 * by colour alone. Use role="alert" for errors that appear after an action, role="status" for results.
 */
export function Notice({ tone = "info", title, className, children, ...rest }: NoticeProps) {
  const { box, icon: Icon } = tones[tone];
  return (
    <div className={cn("flex items-start gap-3 rounded-lg p-4 text-sm", box, className)} {...rest}>
      <Icon aria-hidden="true" size={20} className="mt-0.5 shrink-0" />
      <div className="flex min-w-0 flex-col gap-1">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

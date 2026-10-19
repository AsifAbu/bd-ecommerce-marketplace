import type { ReactNode } from "react";
import { Badge, statusTone } from "@/components/ui";

export { statusTone };

/** A status label. `status` picks the tone through the kit's shared statusTone; `children` is the words shown (default: the status). */
export function StatusBadge({ status, children, ...rest }: { status: string; children?: ReactNode } & Record<`data-${string}`, string>) {
  return (
    <Badge tone={statusTone(status)} {...rest}>
      {children ?? status}
    </Badge>
  );
}

/** "Overdue" in words and vermilion, used the same way on every list. */
export function OverdueFlag({ children = "Overdue", ...rest }: { children?: ReactNode } & Record<`data-${string}`, string>) {
  return (
    <Badge tone="sale" {...rest}>
      {children}
    </Badge>
  );
}

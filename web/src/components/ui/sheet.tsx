"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

/** Sheet = Radix Dialog styled as a drawer. Compose: <Sheet><SheetTrigger/><SheetContent/></Sheet>. Focus is trapped, Escape and the overlay close it, focus returns to the trigger. */
export const Sheet = Dialog.Root;
/** Use `asChild` to make your own button the trigger. */
export const SheetTrigger = Dialog.Trigger;
/** Use `asChild` around a link or button that should close the sheet (e.g. links inside it). */
export const SheetClose = Dialog.Close;

export interface SheetContentProps {
  /** Required: the title read by screen readers, shown in the header unless `hideTitle`. */
  title: string;
  hideTitle?: boolean;
  /** Edge it slides from. Default left. */
  side?: "left" | "right" | "bottom";
  children: ReactNode;
  className?: string;
}

const sides = {
  left: "inset-y-0 left-0 w-[min(20rem,88vw)]",
  right: "inset-y-0 right-0 w-[min(24rem,92vw)]",
  bottom: "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-lg",
} as const;

/** The panel with overlay, title and a close button. Content scrolls inside. */
export function SheetContent({ title, hideTitle, side = "left", children, className }: SheetContentProps) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="sheet-overlay fixed inset-0 z-40" />
      <Dialog.Content
        data-side={side}
        aria-describedby={undefined}
        className={cn("sheet-panel fixed z-50 flex flex-col bg-paper shadow-lg outline-none", sides[side], className)}
      >
        <div className="flex min-h-14 items-center justify-between gap-2 pl-4 pr-1">
          <Dialog.Title className={cn("text-lg font-semibold", hideTitle && "sr-only")}>{title}</Dialog.Title>
          <Dialog.Close
            aria-label="Close"
            className="pressable inline-flex size-11 items-center justify-center rounded-md hover:bg-surface"
          >
            <X aria-hidden="true" size={20} />
          </Dialog.Close>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

"use client";

import { SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button, Sheet, SheetContent, SheetTrigger } from "@/components/ui";

/**
 * Phones and tablets: the filters open in a bottom sheet (Radix: focus trap, Escape, focus
 * returns to the button). The sheet closes by itself when the URL changes, i.e. after Apply.
 * `active` is the number of filters in use.
 */
export function FilterSheet({ active, children }: { active: number; children: ReactNode }) {
  const search = useSearchParams().toString();
  // Remember which URL the sheet was opened on: a new URL closes it without an effect.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === search;
  return (
    <Sheet open={open} onOpenChange={(next) => setOpenedOn(next ? search : null)}>
      <SheetTrigger asChild>
        <Button variant="secondary" className="flex-1 sm:flex-none lg:hidden">
          <SlidersHorizontal aria-hidden="true" size={18} />
          Filters
          {active > 0 && (
            <>
              <span aria-hidden="true" className="tabular inline-flex min-w-5 items-center justify-center rounded-full bg-jade px-1.5 text-xs leading-5 text-paper">
                {active}
              </span>
              <span className="sr-only">({active} applied)</span>
            </>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" title="Filters">
        <div className="px-4 pt-2">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import type { ComponentProps } from "react";
import { cn } from "./cn";

/**
 * Action menu (Radix): arrow keys, type-ahead, Escape, focus return. Use for menus of ACTIONS that
 * need JavaScript anyway (sort, row actions). For navigation menus that must work without
 * JavaScript (header categories, account) use <DisclosureMenu> instead.
 *   <DropdownMenu><DropdownMenuTrigger asChild><Button/></DropdownMenuTrigger>
 *     <DropdownMenuContent><DropdownMenuItem onSelect={...}>Edit</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
 */
export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuLabel = ({ className, ...p }: ComponentProps<typeof Menu.Label>) => (
  <Menu.Label className={cn("px-3 pb-1 pt-2 text-xs font-medium text-muted", className)} {...p} />
);
export const DropdownMenuSeparator = ({ className, ...p }: ComponentProps<typeof Menu.Separator>) => (
  <Menu.Separator className={cn("-mx-1 my-1 h-px bg-line", className)} {...p} />
);

export function DropdownMenuContent({ className, align = "end", sideOffset = 6, ...p }: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "menu-panel z-50 min-w-48 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-paper p-1 shadow-md",
          className,
        )}
        {...p}
      />
    </Menu.Portal>
  );
}

/** One row. Pass `asChild` with a <Link> for navigation. */
export function DropdownMenuItem({ className, ...p }: ComponentProps<typeof Menu.Item>) {
  return (
    <Menu.Item
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface",
        className,
      )}
      {...p}
    />
  );
}

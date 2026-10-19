"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

export function PrintButton() {
  return (
    <Button onClick={() => window.print()}>
      <Printer aria-hidden="true" size={18} />
      Print invoice
    </Button>
  );
}

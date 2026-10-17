"use client";

import { buttonClass } from "@/components/form-styles";

export function PrintButton() {
  return (
    <button type="button" className={buttonClass} onClick={() => window.print()}>
      Print invoice
    </button>
  );
}

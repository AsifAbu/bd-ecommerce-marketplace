"use client";

import { buttonClass } from "@/components/form-styles";

export function PrintSlipButton() {
  return (
    <button type="button" className={buttonClass} onClick={() => window.print()}>
      Print packing slip
    </button>
  );
}

"use client";

import { usePathname } from "next/navigation";

/** Small label beside the logo inside the seller and admin areas ("Dokan | Seller Centre"). Nothing on public pages. */
export function AreaLabel() {
  const path = usePathname();
  const label = path.startsWith("/seller") ? "Seller Centre" : path.startsWith("/admin") ? "Admin" : null;
  if (!label) return null;
  return <span className="hidden whitespace-nowrap border-l border-line pl-3 text-sm font-medium text-muted sm:inline">{label}</span>;
}

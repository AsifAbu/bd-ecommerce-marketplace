"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Notice } from "@/components/ui";
import { withoutIntent } from "../intent";

/**
 * Shown on the product page after a guest logged in to save an item (US-057). Removes the
 * intent from the address bar so a reload or a shared link does not repeat it.
 */
export function WishlistIntentNotice({ result }: { result: "saved" | "failed" }) {
  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}${withoutIntent(window.location.search)}`);
  }, []);

  if (result === "failed") {
    return <Notice tone="error">We couldn&apos;t save this item to your wishlist. Please try again.</Notice>;
  }
  return (
    <Notice tone="success">
      Saved to your wishlist.{" "}
      <Link className="font-medium underline underline-offset-2" href="/account/wishlist">
        View wishlist
      </Link>
    </Notice>
  );
}

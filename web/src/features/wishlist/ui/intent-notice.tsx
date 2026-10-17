"use client";

import Link from "next/link";
import { useEffect } from "react";
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
    return (
      <p role="alert" className="rounded border border-red-700 bg-red-50 px-3 py-2 text-red-900">
        We couldn&apos;t save this item to your wishlist. Please try again.
      </p>
    );
  }
  return (
    <p role="status" className="rounded border border-green-700 bg-green-50 px-3 py-2 text-green-900">
      Saved to your wishlist.{" "}
      <Link className="underline" href="/account/wishlist">
        View wishlist
      </Link>
    </p>
  );
}

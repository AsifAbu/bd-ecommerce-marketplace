"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

/**
 * US-057: moves one wishlist item into the cart (POST /api/wishlist/[id]/move-to-cart). On
 * success the list reloads with ?moved=<id>, which shows the confirmation (the item leaves the list).
 */
export function MoveToCartButton({ itemId, title, describedBy }: { itemId: string; title: string; describedBy?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function move() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/wishlist/${encodeURIComponent(itemId)}/move-to-cart`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? "");
      }
      router.replace(`/account/wishlist?moved=${encodeURIComponent(itemId)}`, { scroll: false });
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Could not move the item. Please try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <Button block loading={busy} onClick={move} aria-label={`Move to cart: ${title}`} aria-describedby={describedBy}>
        Move to cart
      </Button>
      {error && (
        <p role="alert" className="text-sm font-medium text-vermilion">
          {error}
        </p>
      )}
    </>
  );
}

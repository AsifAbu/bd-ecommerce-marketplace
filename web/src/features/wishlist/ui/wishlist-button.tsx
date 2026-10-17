"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { VARIANT_PARAM, wishlistLoginUrl } from "../intent";

interface Saved {
  id: string;
  variantId: string | null;
}

/**
 * The heart on the product page (US-057). Saves the variant chosen in the picker (?variant=).
 * Guests are sent to log in; the product page then saves the item (see intent.ts).
 */
export function WishlistButton({
  productId,
  loggedIn,
  saved: initialSaved,
  variantIds,
  defaultVariantId,
}: {
  productId: string;
  loggedIn: boolean;
  saved: Saved[];
  variantIds: string[];
  /** The only variant of a product without options. */
  defaultVariantId: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const fromUrl = params.get(VARIANT_PARAM);
  const variantId = fromUrl && variantIds.includes(fromUrl) ? fromUrl : defaultVariantId;
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const current = saved.find((s) => s.variantId === variantId);

  async function toggle() {
    if (!loggedIn) {
      router.push(wishlistLoginUrl(productId, variantId));
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (current) {
        const res = await fetch(`/api/wishlist/${encodeURIComponent(current.id)}`, { method: "DELETE" });
        if (!res.ok && res.status !== 404) throw new Error(await errorMessage(res));
        setSaved((s) => s.filter((x) => x.id !== current.id));
        setMessage("Removed from your wishlist.");
      } else {
        const res = await fetch("/api/wishlist", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productId, variantId }),
        });
        if (res.status === 401) {
          router.push(wishlistLoginUrl(productId, variantId));
          return;
        }
        if (!res.ok) throw new Error(await errorMessage(res));
        const { item } = (await res.json()) as { item: Saved };
        setSaved((s) => [...s.filter((x) => x.id !== item.id), item]);
        setMessage("Saved to your wishlist.");
      }
    } catch (err) {
      setMessage(err instanceof Error && err.message ? err.message : "Could not update your wishlist. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="flex items-center gap-2 rounded border border-gray-500 px-4 py-2 font-medium hover:bg-gray-100 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700 disabled:opacity-60"
      >
        <span aria-hidden="true" className={current ? "text-red-700" : ""}>
          {current ? "♥" : "♡"}
        </span>
        {current ? "Remove from wishlist" : "Save to wishlist"}
      </button>
      <p role="status" className="text-sm">
        {message}
        {message && saved.length > 0 && (
          <>
            {" "}
            <Link className="text-blue-800 underline" href="/account/wishlist">
              View wishlist
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message ?? "";
  } catch {
    return "";
  }
}

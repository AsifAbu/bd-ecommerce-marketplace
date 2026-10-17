"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * "Add to cart" on the product page (US-050). Adds the variant chosen in the picker (?variant=,
 * or the only variant). Guests can add too (the cart is kept on the device). The server caps the
 * quantity at the stock and says so.
 */
export function AddToCartButton({
  variants,
  defaultVariantId,
  chooseHint,
}: {
  variants: { id: string; stock: number }[];
  /** The only variant of a product without options. */
  defaultVariantId: string | null;
  /** "Choose size and colour first." */
  chooseHint: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const fromUrl = params.get("variant");
  const variant = variants.find((v) => v.id === fromUrl) ?? variants.find((v) => v.id === defaultVariantId) ?? null;
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const outOfStock = variant !== null && variant.stock <= 0;

  async function add() {
    if (!variant) {
      setMessage({ text: chooseHint, ok: false });
      return;
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      setMessage({ text: "Enter a quantity of at least 1.", ok: false });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variantId: variant.id, quantity: qty }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: { message?: string } };
      if (!res.ok) throw new Error(data.error?.message ?? "");
      setMessage({ text: data.message ?? "Added to your cart.", ok: true });
      router.refresh(); // the header count
    } catch (err) {
      setMessage({ text: err instanceof Error && err.message ? err.message : "Could not add to your cart. Please try again.", ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          Quantity
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={variant ? Math.max(1, variant.stock) : undefined}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-16 rounded border border-gray-500 px-2 py-1 text-center"
          />
        </label>
        <button
          type="button"
          onClick={add}
          disabled={busy || outOfStock}
          className="rounded bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Add to cart
        </button>
      </div>
      <p role="status" className={`text-sm ${message && !message.ok ? "font-semibold text-red-800" : ""}`}>
        {outOfStock && !message ? "This option is out of stock." : message?.text}
        {message?.ok && (
          <>
            {" "}
            <Link className="text-blue-800 underline" href="/cart">
              View cart
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

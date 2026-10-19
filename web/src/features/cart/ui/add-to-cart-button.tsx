"use client";

import { Check, CircleCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Button, cn, QuantityStepper } from "@/components/ui";
import { formatTk } from "@/lib/money";

/**
 * "Add to cart" on the product page (US-050). Adds the variant chosen in the picker (?variant=,
 * or the only variant). Guests can add too (the cart is kept on the device). The server caps the
 * quantity at the stock and says so. On phones a bar above the tab bar repeats the button once
 * the main one has scrolled out of view.
 */
export function AddToCartButton({
  variants,
  defaultVariantId,
  chooseHint,
  priceFallback,
}: {
  variants: { id: string; stock: number; price: number }[];
  /** The only variant of a product without options. */
  defaultVariantId: string | null;
  /** "Choose size and colour first." */
  chooseHint: string;
  /** What the sticky bar shows as price until a variant is chosen, e.g. "Tk 1,850 – Tk 1,950". */
  priceFallback: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const fromUrl = params.get("variant");
  const variant = variants.find((v) => v.id === fromUrl) ?? variants.find((v) => v.id === defaultVariantId) ?? null;
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean; n: number } | null>(null);
  const [barVisible, setBarVisible] = useState(false);
  const inlineRef = useRef<HTMLDivElement>(null);
  const qtyId = useId();
  const outOfStock = variant !== null && variant.stock <= 0;

  // Phones only: show the bar while the main button is not on screen.
  useEffect(() => {
    const el = inlineRef.current;
    if (!el) return;
    const phone = window.matchMedia("(max-width: 1023px)");
    let onScreen = true;
    const update = () => setBarVisible(phone.matches && !onScreen);
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    });
    io.observe(el);
    phone.addEventListener("change", update);
    return () => {
      io.disconnect();
      phone.removeEventListener("change", update);
    };
  }, []);

  async function add() {
    if (!variant) {
      setMessage({ text: chooseHint, ok: false, n: Date.now() });
      return;
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      setMessage({ text: "Enter a quantity of at least 1.", ok: false, n: Date.now() });
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
      setMessage({ text: data.message ?? "Added to your cart.", ok: true, n: Date.now() });
      router.refresh(); // the header count
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1600);
    } catch (err) {
      setMessage({ text: err instanceof Error && err.message ? err.message : "Could not add to your cart. Please try again.", ok: false, n: Date.now() });
    } finally {
      setBusy(false);
    }
  }

  // A small tick beside the label for a moment after a successful add (the label never changes).
  const tick = justAdded && <Check aria-hidden="true" size={18} className="feedback-in" />;

  const status = (
    <p key={message?.n} role="status" className={cn("flex items-start gap-1.5 text-sm", message && "feedback-in", message && !message.ok && "font-medium text-vermilion")}>
      {message?.ok && <CircleCheck aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-jade" />}
      <span>
        {outOfStock && !message ? "This option is out of stock." : message?.text}
        {message?.ok && (
          <>
            {" "}
            <Link className="font-medium text-jade underline underline-offset-2" href="/cart">
              View cart
            </Link>
          </>
        )}
      </span>
    </p>
  );

  return (
    <div className="flex flex-col gap-3">
      <div ref={inlineRef} className="flex items-end gap-3">
        <QuantityStepper
          id={qtyId}
          label="Quantity"
          value={quantity}
          min={1}
          max={variant ? Math.max(1, variant.stock) : undefined}
          onChange={setQuantity}
          onStep={(n) => setQuantity(String(n))}
          decreaseLabel="One less"
          increaseLabel="One more"
        />
        <Button size="lg" className="flex-1" onClick={add} loading={busy} disabled={outOfStock}>
          Add to cart
          {tick}
        </Button>
      </div>
      {!barVisible && status}

      {barVisible && (
        <div
          role="region"
          aria-label="Add to cart"
          className="bar-in fixed inset-x-0 bottom-[var(--tabbar-space)] z-20 border-t border-line bg-paper px-4 py-2.5 lg:hidden"
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              {message || outOfStock ? (
                status
              ) : (
                <p className="tabular truncate text-base font-semibold">{variant ? formatTk(variant.price) : priceFallback}</p>
              )}
            </div>
            <Button size="lg" onClick={add} loading={busy} disabled={outOfStock}>
              Add to cart
              {tick}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

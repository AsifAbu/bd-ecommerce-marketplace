"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ProductImage } from "@/components/product-image";
import { describeDelivery, type DeliveryZone } from "@/lib/delivery";
import { setDeliveryZoneAction } from "../actions";
import { DELIVERY_ZONES, MAX_LINE_QUANTITY, tk, ZONE_LABELS, type Cart, type CartLine, type Readiness, type ShopGroup, type ZoneSource } from "../model";

/**
 * The /cart page (US-050, US-056, US-058): lines grouped by shop with each shop's subtotal,
 * delivery charge and free-delivery hint, quantity controls, remove, save for later, price-change
 * notices, the saved list and the totals. Every control is a native button or input (keyboard).
 * Changes go through the JSON API, then the server-rendered cart is refreshed.
 */

const btn =
  "rounded border px-3 py-1 text-sm font-medium focus:outline-2 focus:outline-offset-2 focus:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const primary = "rounded bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700";

type Patch = { quantity?: number; savedForLater?: boolean; acknowledgePrice?: boolean };

async function send(url: string, method: string, body?: unknown): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string; error?: { message?: string } };
    if (!res.ok) return { ok: false, message: data.error?.message ?? "Could not update your cart. Please try again." };
    return { ok: true, message: data.message ?? "" };
  } catch {
    return { ok: false, message: "Could not reach the server. Check your connection and try again." };
  }
}

export function CartView({
  cart,
  readiness,
  zone,
}: {
  cart: Cart;
  readiness: Readiness;
  zone: { zone: DeliveryZone; source: ZoneSource };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, { text: string; error: boolean }>>({});
  const [status, setStatus] = useState("");
  // The radio follows the click at once; the charges follow when the refreshed cart arrives.
  const [chosenZone, setChosenZone] = useState(zone.zone);

  async function run(lineId: string, url: string, method: string, body?: unknown) {
    setBusyId(lineId);
    const result = await send(url, method, body);
    setBusyId(null);
    const text = result.message || (result.ok ? "Cart updated." : "Could not update your cart.");
    setMessages((m) => ({ ...m, [lineId]: { text, error: !result.ok } }));
    setStatus(text);
    startTransition(() => router.refresh());
  }

  const patch = (line: CartLine, body: Patch) => run(line.id, `/api/cart/items/${encodeURIComponent(line.id)}`, "PATCH", body);
  const remove = (line: CartLine) => run(line.id, `/api/cart/items/${encodeURIComponent(line.id)}`, "DELETE");

  function chooseZone(next: DeliveryZone) {
    setChosenZone(next);
    startTransition(async () => {
      await setDeliveryZoneAction(next);
      setStatus(`Delivery charges now for ${ZONE_LABELS[next]}.`);
      router.refresh();
    });
  }

  const lineProps = { busy: (l: CartLine) => busyId === l.id, messages, patch, remove };
  const empty = cart.groups.length === 0 && cart.unavailable.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <fieldset className="flex flex-col gap-2 rounded border border-gray-300 p-4">
        <legend className="px-1 font-semibold">Delivery area</legend>
        <div className="flex flex-wrap gap-4">
          {DELIVERY_ZONES.map((z) => (
            <label key={z} className="flex items-center gap-2">
              <input
                type="radio"
                name="delivery-zone"
                value={z}
                checked={chosenZone === z}
                onChange={() => chooseZone(z)}
                disabled={pending}
                className="accent-blue-700"
              />
              {ZONE_LABELS[z]}
            </label>
          ))}
        </div>
        <p className="text-sm text-gray-700">
          {zone.source === "address"
            ? "Based on your default address. Change it here to compare."
            : zone.source === "chosen"
              ? "You chose this area. You give the full address at checkout."
              : "Choose where your order goes; delivery charges depend on it."}
        </p>
      </fieldset>

      {empty && (
        <p>
          Your cart is empty.{" "}
          <Link className="text-blue-800 underline" href="/">
            Start shopping
          </Link>
        </p>
      )}

      {cart.groups.map((group) => (
        <ShopSection key={group.shop.id} group={group} {...lineProps} />
      ))}

      {cart.unavailable.length > 0 && (
        <section aria-labelledby="unavailable-heading" className="flex flex-col gap-3 rounded border border-red-300 p-4">
          <h2 id="unavailable-heading" className="text-xl font-semibold">
            Can&apos;t be ordered now
          </h2>
          <p className="text-sm">These items are not in your totals and won&apos;t be ordered.</p>
          <ul className="flex flex-col gap-4">
            {cart.unavailable.map((line) => (
              <LineItem key={`${line.id}:${line.quantity}`} line={line} {...lineProps} />
            ))}
          </ul>
        </section>
      )}

      {cart.groups.length > 0 && <Summary cart={cart} readiness={readiness} />}

      {cart.saved.length > 0 && (
        <section aria-labelledby="saved-heading" className="flex flex-col gap-3 rounded border border-gray-300 p-4">
          <h2 id="saved-heading" className="text-xl font-semibold">
            Saved for later ({cart.saved.length})
          </h2>
          <p className="text-sm">Not in your cart totals. Move an item back to buy it.</p>
          <ul className="flex flex-col gap-4" aria-label="Saved for later">
            {cart.saved.map((line) => (
              <LineItem key={`${line.id}:${line.quantity}`} line={line} {...lineProps} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

interface LineHandlers {
  busy: (line: CartLine) => boolean;
  messages: Record<string, { text: string; error: boolean }>;
  patch: (line: CartLine, body: Patch) => void;
  remove: (line: CartLine) => void;
}

function ShopSection({ group, ...handlers }: { group: ShopGroup } & LineHandlers) {
  const headingId = `shop-${group.shop.id}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded border border-gray-300 p-4">
      <h2 id={headingId} className="text-xl font-semibold">
        <Link className="text-blue-800 underline" href={group.shop.href}>
          {group.shop.name}
        </Link>
      </h2>
      <ul className="flex flex-col gap-4" aria-label={`Items from ${group.shop.name}`}>
        {group.lines.map((line) => (
          <LineItem key={`${line.id}:${line.quantity}`} line={line} {...handlers} />
        ))}
      </ul>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-gray-200 pt-3" aria-label={`${group.shop.name} order`}>
        <dt>Subtotal ({group.itemCount} {group.itemCount === 1 ? "item" : "items"})</dt>
        <dd className="text-right">{tk(group.subtotal)}</dd>
        <dt>Delivery</dt>
        <dd className="text-right">
          {group.freeDelivery ? (
            <>
              <s className="text-gray-600">{tk(group.delivery.total)}</s> <strong>Free delivery</strong>
            </>
          ) : (
            describeDelivery(group.delivery)
          )}
        </dd>
        <dt className="font-semibold">Shop total</dt>
        <dd className="text-right font-semibold">{tk(group.total)}</dd>
      </dl>
      {group.amountForFreeDelivery !== null && (
        <p className="text-sm text-green-900">
          Add {tk(group.amountForFreeDelivery)} more from this shop for free delivery (orders of {tk(group.freeDeliveryThreshold!)} or
          more).
        </p>
      )}
      {group.freeDelivery && (
        <p className="text-sm text-green-900">This shop delivers free for orders of {tk(group.freeDeliveryThreshold!)} or more.</p>
      )}
    </section>
  );
}

function LineItem({ line, busy, messages, patch, remove }: { line: CartLine } & LineHandlers) {
  const [qty, setQty] = useState(String(line.quantity));
  const disabled = busy(line);
  const orderable = line.status === "available";
  const max = Math.max(1, Math.min(line.stock, MAX_LINE_QUANTITY));
  const message = messages[line.id];
  const qtyId = `qty-${line.id}`;

  function commit(value: number) {
    if (!Number.isInteger(value) || value < 1) {
      setQty(String(line.quantity));
      return;
    }
    // Show the capped value at once (the server caps too and says why); a capped value that
    // equals the stored one doesn't remount the line, so the field must not keep the typed number.
    setQty(String(Math.min(value, max)));
    if (value !== line.quantity) patch(line, { quantity: value });
  }

  return (
    <li className="flex flex-wrap gap-4">
      <ProductImage imageId={line.imageId} alt="" className="h-20 w-20 shrink-0 rounded" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link className="font-semibold text-blue-800 underline" href={line.href}>
          {line.title}
        </Link>
        {line.variantLabel && <p className="text-sm">{line.variantLabel}</p>}
        <p>
          {tk(line.unitPrice)} each
          {orderable && !line.savedForLater && <span className="text-gray-700"> · {tk(line.lineTotal)}</span>}
        </p>
        {line.savedForLater && !orderable && <p className="text-sm font-semibold text-red-800">{line.status === "out_of_stock" ? "Out of stock" : "No longer available"}</p>}
        {line.notices.map((n) => (
          <p
            key={n}
            className={`text-sm ${line.priceChanged && n.startsWith("The price") ? "rounded border border-amber-600 bg-amber-50 px-2 py-1 text-amber-950" : orderable ? "text-gray-800" : "font-semibold text-red-800"}`}
          >
            {n}
          </p>
        ))}
        {line.priceChanged && orderable && !line.savedForLater && (
          <div>
            <button type="button" className={`${btn} border-amber-700`} disabled={disabled} onClick={() => patch(line, { acknowledgePrice: true })} aria-label={`Accept new price: ${line.title}`}>
              Accept new price
            </button>
          </div>
        )}
        {message && (
          <p className={`text-sm ${message.error ? "font-semibold text-red-800" : "text-green-900"}`}>{message.text}</p>
        )}
      </div>

      <div className="flex flex-col items-start gap-2">
        {orderable && !line.savedForLater && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={`${btn} border-gray-500`}
              aria-label={`Decrease quantity of ${line.title}`}
              disabled={disabled || line.quantity <= 1}
              onClick={() => commit(line.quantity - 1)}
            >
              −
            </button>
            <label htmlFor={qtyId} className="sr-only">
              Quantity of {line.title}
            </label>
            <input
              id={qtyId}
              type="number"
              inputMode="numeric"
              min={1}
              max={max}
              value={qty}
              disabled={disabled}
              onChange={(e) => setQty(e.target.value)}
              onBlur={() => commit(Number(qty))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit(Number(qty));
                }
              }}
              className="w-16 rounded border border-gray-500 px-2 py-1 text-center"
            />
            <button
              type="button"
              className={`${btn} border-gray-500`}
              aria-label={`Increase quantity of ${line.title}`}
              disabled={disabled}
              onClick={() => commit(line.quantity + 1)}
            >
              +
            </button>
          </div>
        )}
        {line.savedForLater ? (
          <button type="button" className={`${btn} border-blue-700 text-blue-800`} disabled={disabled} onClick={() => patch(line, { savedForLater: false })} aria-label={`Move to cart: ${line.title}`}>
            Move to cart
          </button>
        ) : (
          <button type="button" className={`${btn} border-gray-500`} disabled={disabled} onClick={() => patch(line, { savedForLater: true })} aria-label={`Save for later: ${line.title}`}>
            Save for later
          </button>
        )}
        <button type="button" className={`${btn} border-red-700 text-red-800`} disabled={disabled} onClick={() => remove(line)} aria-label={`Remove: ${line.title}`}>
          Remove
        </button>
      </div>
    </li>
  );
}

function Summary({ cart, readiness }: { cart: Cart; readiness: Readiness }) {
  const shops = cart.groups.length;
  return (
    <section aria-labelledby="summary-heading" className="flex flex-col gap-3 rounded border-2 border-gray-400 p-4">
      <h2 id="summary-heading" className="text-xl font-semibold">
        Order summary
      </h2>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        <dt>Items ({cart.itemCount})</dt>
        <dd className="text-right">{tk(cart.subtotal)}</dd>
        <dt>
          Delivery ({shops} {shops === 1 ? "shop" : "shops"}, {ZONE_LABELS[cart.zone]})
        </dt>
        <dd className="text-right">{tk(cart.deliveryTotal)}</dd>
        <dt className="text-lg font-bold">Total</dt>
        <dd className="text-right text-lg font-bold">{tk(cart.grandTotal)}</dd>
      </dl>
      <p className="text-sm text-gray-700">
        Each shop ships its own order with its own delivery charge. Pay cash on delivery.
      </p>
      {readiness.ready ? (
        <Link href="/checkout" className={`${primary} self-start`}>
          Checkout
        </Link>
      ) : (
        <>
          <button type="button" disabled aria-describedby="checkout-blocked" className={`${primary} self-start disabled:cursor-not-allowed disabled:opacity-60`}>
            Checkout
          </button>
          <ul id="checkout-blocked" className="text-sm font-semibold text-amber-900">
            {readiness.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

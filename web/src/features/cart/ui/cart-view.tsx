"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ProductThumb } from "@/components/product-thumb";
import { Button, buttonStyles, ChoiceChip, cn, EmptyState, Notice, QuantityStepper } from "@/components/ui";
import { describeDelivery, type DeliveryZone } from "@/lib/delivery";
import { setDeliveryZoneAction } from "../actions";
import { DELIVERY_ZONES, MAX_LINE_QUANTITY, tk, ZONE_LABELS, type Cart, type CartLine, type Readiness, type ShopGroup, type ZoneSource } from "../model";

/**
 * The /cart page (US-050, US-056, US-058): lines grouped by shop with each shop's subtotal,
 * delivery charge and free-delivery hint, quantity controls, remove, save for later, price-change
 * notices, the saved list and the totals. Every control is a native button or input (keyboard).
 * Changes go through the JSON API, then the server-rendered cart is refreshed.
 *
 * Layout: one column on phones with the order summary pinned above the tab bar; from lg the
 * summary is a sticky panel beside the list.
 */

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
    <div className="flex flex-col gap-8">
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {empty && cart.saved.length === 0 ? (
        <EmptyState
          title="Your cart is empty"
          description="Find something you like and add it here. Items from different shops can share one cart."
          action={
            <Link className={buttonStyles({ variant: "primary" })} href="/">
              Start shopping
            </Link>
          }
        />
      ) : (
        <div className="grid items-start gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="flex min-w-0 flex-col gap-10 lg:col-start-1 lg:row-start-1">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium text-ink">Delivery area</legend>
              <div className="flex flex-wrap gap-2">
                {DELIVERY_ZONES.map((z) => (
                  <ChoiceChip key={z} name="delivery-zone" value={z} checked={chosenZone === z} onChange={() => chooseZone(z)} disabled={pending}>
                    {ZONE_LABELS[z]}
                  </ChoiceChip>
                ))}
              </div>
              <p className="text-sm text-muted">
                {zone.source === "address"
                  ? "Based on your default address. Change it here to compare."
                  : zone.source === "chosen"
                    ? "You chose this area. You give the full address at checkout."
                    : "Choose where your order goes; delivery charges depend on it."}
              </p>
            </fieldset>

            {empty && <EmptyState title="Nothing to order right now" description="Your saved items are below. Move one back to your cart to buy it." />}

            {cart.groups.map((group) => (
              <ShopSection key={group.shop.id} group={group} {...lineProps} />
            ))}

            {cart.unavailable.length > 0 && (
              <section aria-labelledby="unavailable-heading" className="flex flex-col gap-3">
                <h2 id="unavailable-heading" className="text-lg">
                  Can&apos;t be ordered now
                </h2>
                <p className="text-sm text-muted">These items are not in your totals and won&apos;t be ordered.</p>
                <ul className="flex flex-col divide-y divide-line">
                  {cart.unavailable.map((line) => (
                    <LineItem key={`${line.id}:${line.quantity}`} line={line} {...lineProps} />
                  ))}
                </ul>
              </section>
            )}

            {cart.saved.length > 0 && (
              <section aria-labelledby="saved-heading" className="flex flex-col gap-3">
                <h2 id="saved-heading" className="text-lg">
                  Saved for later ({cart.saved.length})
                </h2>
                <p className="text-sm text-muted">Not in your cart totals. Move an item back to buy it.</p>
                <ul className="flex flex-col divide-y divide-line" aria-label="Saved for later">
                  {cart.saved.map((line) => (
                    <LineItem key={`${line.id}:${line.quantity}`} line={line} {...lineProps} />
                  ))}
                </ul>
              </section>
            )}
          </div>

          {cart.groups.length > 0 && <Summary cart={cart} readiness={readiness} />}
        </div>
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
  const progress =
    group.freeDeliveryThreshold && group.amountForFreeDelivery !== null
      ? Math.min(100, Math.round((group.subtotal / group.freeDeliveryThreshold) * 100))
      : null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <h2 id={headingId} className="text-lg">
        <Link className="underline-offset-4 hover:underline" href={group.shop.href}>
          {group.shop.name}
        </Link>
      </h2>
      <ul className="flex flex-col divide-y divide-line" aria-label={`Items from ${group.shop.name}`}>
        {group.lines.map((line) => (
          <LineItem key={`${line.id}:${line.quantity}`} line={line} {...handlers} />
        ))}
      </ul>
      <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 border-t border-line pt-4 text-sm" aria-label={`${group.shop.name} order`}>
        <dt className="text-muted">
          Subtotal ({group.itemCount} {group.itemCount === 1 ? "item" : "items"})
        </dt>
        <dd className="tabular text-right">{tk(group.subtotal)}</dd>
        <dt className="text-muted">Delivery</dt>
        <dd className="tabular text-right">
          {group.freeDelivery ? (
            <>
              <s className="text-muted">{tk(group.delivery.total)}</s> <strong className="font-semibold text-jade">Free delivery</strong>
            </>
          ) : (
            describeDelivery(group.delivery)
          )}
        </dd>
        <dt className="font-semibold">Shop total</dt>
        <dd className="tabular text-right font-semibold">{tk(group.total)}</dd>
      </dl>
      {group.amountForFreeDelivery !== null && (
        <div className="mt-2 flex flex-col gap-1.5">
          <p className="text-sm text-jade-hover">
            Add {tk(group.amountForFreeDelivery)} more from this shop for free delivery (orders of {tk(group.freeDeliveryThreshold!)} or more).
          </p>
          {progress !== null && (
            <div aria-hidden="true" className="h-1 overflow-hidden rounded-sm bg-surface">
              <div className="h-full rounded-sm bg-jade transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-out)]" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}
      {group.freeDelivery && (
        <p className="mt-2 text-sm text-jade-hover">This shop delivers free for orders of {tk(group.freeDeliveryThreshold!)} or more.</p>
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
    <li className="flex gap-4 py-5">
      <Link href={line.href} tabIndex={-1} aria-hidden="true" className="shrink-0">
        <ProductThumb
          src={line.imageId ? `/api/product-images/${encodeURIComponent(line.imageId)}` : null}
          title={line.title}
          decorative
          className="aspect-[4/5] w-20 rounded-md sm:w-24"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link className="line-clamp-2 font-medium underline-offset-4 hover:underline" href={line.href}>
              {line.title}
            </Link>
            {line.variantLabel && <p className="text-sm text-muted">{line.variantLabel}</p>}
          </div>
          {orderable && !line.savedForLater ? (
            <p className="tabular shrink-0 text-right font-semibold">{tk(line.lineTotal)}</p>
          ) : (
            <p className="tabular shrink-0 text-right text-muted">{tk(line.unitPrice)}</p>
          )}
        </div>
        {orderable && !line.savedForLater && line.quantity > 1 && <p className="tabular text-sm text-muted">{tk(line.unitPrice)} each</p>}
        {line.savedForLater && !orderable && (
          <p className="text-sm font-medium text-vermilion">{line.status === "out_of_stock" ? "Out of stock" : "No longer available"}</p>
        )}
        {line.notices.map((n) =>
          line.priceChanged && n.startsWith("The price") ? (
            <Notice key={n} tone="warning" className="items-center">
              {n}
            </Notice>
          ) : (
            <p key={n} className={cn("text-sm", orderable ? "text-muted" : "font-medium text-vermilion")}>
              {n}
            </p>
          ),
        )}
        {message && <p className={cn("text-sm", message.error ? "font-medium text-vermilion" : "text-muted")}>{message.text}</p>}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {orderable && !line.savedForLater && (
            <QuantityStepper
              id={qtyId}
              label={`Quantity of ${line.title}`}
              hideLabel
              value={qty}
              min={1}
              max={max}
              disabled={disabled}
              onChange={setQty}
              onStep={commit}
              onCommit={commit}
              decreaseLabel={`Decrease quantity of ${line.title}`}
              increaseLabel={`Increase quantity of ${line.title}`}
            />
          )}
          {line.priceChanged && orderable && !line.savedForLater && (
            <Button variant="secondary" disabled={disabled} onClick={() => patch(line, { acknowledgePrice: true })} aria-label={`Accept new price: ${line.title}`}>
              Accept new price
            </Button>
          )}
          {line.savedForLater ? (
            <Button variant="secondary" disabled={disabled} onClick={() => patch(line, { savedForLater: false })} aria-label={`Move to cart: ${line.title}`}>
              Move to cart
            </Button>
          ) : (
            <Button variant="ghost" className="px-2 text-sm text-muted hover:text-ink" disabled={disabled} onClick={() => patch(line, { savedForLater: true })} aria-label={`Save for later: ${line.title}`}>
              Save for later
            </Button>
          )}
          <Button variant="ghost" className="px-2 text-sm text-muted hover:text-vermilion" disabled={disabled} onClick={() => remove(line)} aria-label={`Remove: ${line.title}`}>
            Remove
          </Button>
        </div>
      </div>
    </li>
  );
}

function Summary({ cart, readiness }: { cart: Cart; readiness: Readiness }) {
  const shops = cart.groups.length;
  return (
    <section
      aria-labelledby="summary-heading"
      className={cn(
        // Phones: pinned above the tab bar, full width. Desktop: a sticky quiet panel beside the list.
        "sticky bottom-[var(--tabbar-space)] z-10 -mx-4 border-t border-line bg-paper px-4 py-3 sm:-mx-6 sm:px-6",
        "lg:bottom-auto lg:top-24 lg:col-start-2 lg:row-start-1 lg:mx-0 lg:rounded-lg lg:border-0 lg:bg-surface lg:p-6",
        "max-lg:grid max-lg:grid-cols-[1fr_auto] max-lg:items-center max-lg:gap-x-4 max-lg:gap-y-2 lg:flex lg:flex-col lg:gap-4",
      )}
    >
      <h2 id="summary-heading" className="text-lg max-lg:sr-only">
        Order summary
      </h2>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm lg:text-base">
        <dt className="text-muted">Items ({cart.itemCount})</dt>
        <dd className="tabular text-right">{tk(cart.subtotal)}</dd>
        <dt className="text-muted">
          Delivery ({shops} {shops === 1 ? "shop" : "shops"}, {ZONE_LABELS[cart.zone]})
        </dt>
        <dd className="tabular text-right">{tk(cart.deliveryTotal)}</dd>
        <dt className="font-semibold lg:text-lg">Total</dt>
        <dd className="tabular text-right font-semibold lg:text-lg">{tk(cart.grandTotal)}</dd>
      </dl>
      <p className="text-sm text-muted max-lg:hidden">Each shop ships its own order with its own delivery charge. Pay cash on delivery.</p>
      {readiness.ready ? (
        <Link href="/checkout" className={buttonStyles({ size: "lg", block: true })}>
          Checkout
        </Link>
      ) : (
        <>
          <Button size="lg" block disabled aria-describedby="checkout-blocked">
            Checkout
          </Button>
          <ul id="checkout-blocked" className="text-sm font-medium text-gold-ink max-lg:col-span-2">
            {readiness.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

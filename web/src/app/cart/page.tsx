import { connection } from "next/server";
import { Suspense } from "react";
import { buildCart, cartReadyForCheckout } from "@/features/cart";
import { cartService, resolveCartOwner, resolveDeliveryZone } from "@/features/cart/server";
import { CartView } from "@/features/cart/ui/cart-view";

export const metadata = { title: "Your cart" };

/** US-050, US-056, US-058: the cart of the logged-in customer or of this guest device. */
export default function CartPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-bold">Your cart</h1>
      <Suspense fallback={<p role="status">Loading your cart…</p>}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  await connection(); // cookies, session and today's prices are request-time
  const owner = await resolveCartOwner({ writable: false });
  const zone = await resolveDeliveryZone(owner);
  const cart = owner ? await cartService.getCart(owner, zone.zone) : buildCart([], { zone: zone.zone, today: new Date() });
  return <CartView cart={cart} readiness={cartReadyForCheckout(cart)} zone={zone} />;
}

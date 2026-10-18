import { connection } from "next/server";
import { Suspense } from "react";
import { PageMain, Skeleton } from "@/components/ui";
import { buildCart, cartReadyForCheckout } from "@/features/cart";
import { cartService, resolveCartOwner, resolveDeliveryZone } from "@/features/cart/server";
import { CartView } from "@/features/cart/ui/cart-view";

export const metadata = { title: "Your cart" };

/** US-050, US-056, US-058: the cart of the logged-in customer or of this guest device. */
export default function CartPage() {
  return (
    <PageMain className="gap-6">
      <h1 className="text-3xl sm:text-4xl">Your cart</h1>
      <Suspense fallback={<CartSkeleton />}>
        <Content />
      </Suspense>
    </PageMain>
  );
}

function CartSkeleton() {
  return (
    <div role="status" aria-label="Loading your cart" className="flex flex-col gap-6">
      <Skeleton className="h-11 w-64" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

async function Content() {
  await connection(); // cookies, session and today's prices are request-time
  const owner = await resolveCartOwner({ writable: false });
  const zone = await resolveDeliveryZone(owner);
  const cart = owner ? await cartService.getCart(owner, zone.zone) : buildCart([], { zone: zone.zone, today: new Date() });
  return <CartView cart={cart} readiness={cartReadyForCheckout(cart)} zone={zone} />;
}

import { Suspense } from "react";
import { CheckoutContent } from "@/features/orders/ui/checkout-content";

export const metadata = { title: "Checkout" };

/** US-051 (logged in) and US-007 (guest): cash-on-delivery checkout of the whole cart, one order per shop. */
export default function CheckoutPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-bold">Checkout</h1>
      <Suspense fallback={<p role="status">Loading checkout…</p>}>
        <CheckoutContent />
      </Suspense>
    </main>
  );
}

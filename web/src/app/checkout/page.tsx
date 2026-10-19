import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { CheckoutContent } from "@/features/orders/ui/checkout-content";

export const metadata = { title: "Checkout" };

/** US-051 (logged in) and US-007 (guest): cash-on-delivery checkout of the whole cart, one order per shop. */
export default function CheckoutPage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-3xl sm:text-4xl">Checkout</h1>
      <Suspense
        fallback={
          <div role="status" aria-label="Loading checkout" className="flex flex-col gap-4">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        }
      >
        <CheckoutContent />
      </Suspense>
    </main>
  );
}

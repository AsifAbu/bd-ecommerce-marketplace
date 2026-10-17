import Link from "next/link";

export const metadata = { title: "Checkout" };

/** Placeholder until checkout with cash on delivery (US-051) is built in the next sprint. */
export default function CheckoutPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-3xl font-bold">Checkout</h1>
      <p>Checkout is coming in the next update. Your cart is saved.</p>
      <p>
        <Link className="text-blue-800 underline" href="/cart">
          Back to your cart
        </Link>
      </p>
    </main>
  );
}

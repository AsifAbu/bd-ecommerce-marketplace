import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { currentUserOrNull } from "@/features/cart/server";
import { viewableOrder } from "@/features/orders/server";
import { OrderDetail } from "@/features/orders/ui/order-view";

export const metadata = { title: "Your order", robots: { index: false } };

/**
 * Order confirmation and detail (US-051, US-052, US-008): the customer's own order, or a guest's
 * order this browser placed or tracked with an OTP. Anyone else sees "not found".
 */
export default function OrderPage({ params, searchParams }: PageProps<"/orders/[orderNo]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <Suspense fallback={<p role="status">Loading your order…</p>}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ orderNo: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { orderNo } = await params;
  const { placed } = await searchParams;
  const order = await viewableOrder(decodeURIComponent(orderNo));
  if (!order) {
    const user = await currentUserOrNull();
    return (
      <>
        <h1 className="text-3xl font-bold">Order not found</h1>
        <p>
          We can&apos;t show this order here.{" "}
          {user ? (
            <Link className="text-blue-800 underline" href="/account/orders">
              See your orders
            </Link>
          ) : (
            <>
              <Link className="text-blue-800 underline" href={`/login?callbackUrl=${encodeURIComponent(`/orders/${orderNo}`)}`}>
                Log in
              </Link>{" "}
              or{" "}
              <Link className="text-blue-800 underline" href={`/track?orderNo=${encodeURIComponent(orderNo)}`}>
                track it with a code sent to your mobile
              </Link>
            </>
          )}
          .
        </p>
      </>
    );
  }
  return (
    <>
      <h1 className="text-3xl font-bold">Order {order.orderNo}</h1>
      <OrderDetail order={order} placed={placed === "1"} />
    </>
  );
}

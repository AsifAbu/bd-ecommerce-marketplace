import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { currentUserOrNull } from "@/features/cart/server";
import { buildTimeline } from "@/features/orders/lifecycle";
import { orderTimelines } from "@/features/orders/lifecycle/server";
import { CustomerShopOrderLifecycle } from "@/features/orders/lifecycle/ui/customer-lifecycle";
import { viewableOrder } from "@/features/orders/server";
import { OrderComplaints } from "@/features/complaints/ui/order-complaints";
import { OrderDetail } from "@/features/orders/ui/order-view";
import { OrderReturns } from "@/features/returns/ui/order-returns";
import { reviewService } from "@/features/reviews/server";
import { ItemReview } from "@/features/reviews/ui/item-review";

export const metadata = { title: "Your order", robots: { index: false } };

/**
 * Order confirmation and detail (US-051, US-052, US-008): the customer's own order, or a guest's
 * order this browser placed or tracked with an OTP. Anyone else sees "not found".
 */
export default function OrderPage({ params, searchParams }: PageProps<"/orders/[orderNo]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
      <Suspense fallback={<Skeleton role="status" aria-label="Loading your order" className="h-64 w-full" />}>
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
  const { placed, return: returned, photos } = await searchParams;
  const order = await viewableOrder(decodeURIComponent(orderNo));
  if (!order) {
    const user = await currentUserOrNull();
    return (
      <>
        <h1 className="text-3xl sm:text-4xl">Order not found</h1>
        <p className="max-w-prose">
          We can&apos;t show this order here.{" "}
          {user ? (
            <Link className="font-medium text-jade underline underline-offset-2" href="/account/orders">
              See your orders
            </Link>
          ) : (
            <>
              <Link className="font-medium text-jade underline underline-offset-2" href={`/login?callbackUrl=${encodeURIComponent(`/orders/${orderNo}`)}`}>
                Log in
              </Link>{" "}
              or{" "}
              <Link className="font-medium text-jade underline underline-offset-2" href={`/track?orderNo=${encodeURIComponent(orderNo)}`}>
                track it with a code sent to your mobile
              </Link>
            </>
          )}
          .
        </p>
      </>
    );
  }
  // US-055: "Write a review" under each delivered item of the logged-in buyer's own order.
  const user = await currentUserOrNull();
  const itemIds = order.shopOrders.flatMap((so) => so.items.map((i) => i.id));
  const states = user ? await reviewService.itemStates(user.id, itemIds) : {};
  const itemExtras = Object.fromEntries(Object.entries(states).map(([id, state]) => [id, <ItemReview key={id} orderItemId={id} state={state} />]));
  // US-053: each shop order's timeline, courier and tracking, and Cancel before confirmation.
  const timelines = new Map((await orderTimelines(order.id)).map((t) => [t.id, t]));
  return (
    <>
      <h1 className="text-3xl sm:text-4xl">Order {order.orderNo}</h1>
      <OrderDetail
        order={order}
        placed={placed === "1"}
        itemExtras={itemExtras}
        shopOrderExtra={(so) => {
          const t = timelines.get(so.id);
          if (!t) return null;
          return (
            <CustomerShopOrderLifecycle
              orderNo={order.orderNo}
              shopOrderId={so.id}
              shopOrderNo={so.shopOrderNo}
              status={t.status}
              timeline={buildTimeline({ status: t.status, statusChangedAt: t.statusChangedAt, placedAt: new Date(order.placedAt) }, t.events)}
              courier={t.courierName ? { name: t.courierName, trackingNo: t.trackingNo } : null}
            />
          );
        }}
      />
      <OrderReturns orderId={order.id} notice={returned === "requested" ? (photos === "unsaved" ? "requested-no-photos" : "requested") : undefined} />
      <OrderComplaints orderId={order.id} orderNo={order.orderNo} />
    </>
  );
}

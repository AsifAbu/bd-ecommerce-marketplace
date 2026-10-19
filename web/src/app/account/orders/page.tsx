import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { userOrLogin } from "@/features/accounts/page-guards";
import { ordersOfUser } from "@/features/orders/server";
import { OrderList } from "@/features/orders/ui/order-view";
import { reviewService } from "@/features/reviews/server";

export const metadata = { title: "My orders" };

/** US-052: the customer's orders with each shop order's status (guest orders linked by US-009 included). */
export default function MyOrdersPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-3xl sm:text-4xl">My orders</h1>
      <Suspense fallback={<Skeleton role="status" aria-label="Loading your orders" aria-hidden={false} className="h-48 w-full" />}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  const user = await userOrLogin("/account/orders");
  const [orders, { awaiting }] = await Promise.all([ordersOfUser(user.id), reviewService.myReviews(user.id)]);
  return (
    <>
      {/* US-055: delivered items can be reviewed (also from each order's page). */}
      <p className="text-sm text-muted" data-testid="reviews-link">
        {awaiting.length > 0 ? `${awaiting.length} delivered ${awaiting.length === 1 ? "item is" : "items are"} waiting for your review. ` : ""}
        <Link className="font-medium text-jade underline underline-offset-2" href="/account/reviews">
          {awaiting.length > 0 ? "Write a review" : "My reviews"}
        </Link>
      </p>
      <OrderList orders={orders} />
    </>
  );
}

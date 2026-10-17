import Link from "next/link";
import { Suspense } from "react";
import { userOrLogin } from "@/features/accounts/page-guards";
import { Loading, PageShell } from "@/features/accounts/ui/page-shell";
import { ordersOfUser } from "@/features/orders/server";
import { OrderList } from "@/features/orders/ui/order-view";
import { reviewService } from "@/features/reviews/server";

export const metadata = { title: "My orders" };

/** US-052: the customer's orders with each shop order's status (guest orders linked by US-009 included). */
export default function MyOrdersPage() {
  return (
    <PageShell title="My orders" wide>
      <Suspense fallback={<Loading />}>
        <Content />
      </Suspense>
    </PageShell>
  );
}

async function Content() {
  const user = await userOrLogin("/account/orders");
  const [orders, { awaiting }] = await Promise.all([ordersOfUser(user.id), reviewService.myReviews(user.id)]);
  return (
    <>
      {/* US-055: delivered items can be reviewed (also from each order's page). */}
      <p className="text-sm" data-testid="reviews-link">
        {awaiting.length > 0 ? `${awaiting.length} delivered ${awaiting.length === 1 ? "item is" : "items are"} waiting for your review. ` : ""}
        <Link className="text-blue-800 underline" href="/account/reviews">
          {awaiting.length > 0 ? "Write a review" : "My reviews"}
        </Link>
      </p>
      <OrderList orders={orders} />
    </>
  );
}

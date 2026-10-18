import { Suspense } from "react";
import { PageHeader, TextLink } from "@/components/ui";
import { userOrLogin } from "@/features/accounts/page-guards";
import { ListSkeleton } from "@/features/accounts/ui/auth-shell";
import { ordersOfUser } from "@/features/orders/server";
import { OrderList } from "@/features/orders/ui/order-view";
import { reviewService } from "@/features/reviews/server";

export const metadata = { title: "My orders" };

/** US-052: the customer's orders with each shop order's status (guest orders linked by US-009 included). */
export default function MyOrdersPage() {
  return (
    <>
      <PageHeader title="My orders" />
      <Suspense fallback={<ListSkeleton />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const user = await userOrLogin("/account/orders");
  const [orders, { awaiting }] = await Promise.all([ordersOfUser(user.id), reviewService.myReviews(user.id)]);
  return (
    <>
      {/* US-055: delivered items can be reviewed (also from each order's page). */}
      <p data-testid="reviews-link" className="text-muted">
        {awaiting.length > 0 ? `${awaiting.length} delivered ${awaiting.length === 1 ? "item is" : "items are"} waiting for your review. ` : ""}
        <TextLink href="/account/reviews">{awaiting.length > 0 ? "Write a review" : "My reviews"}</TextLink>
      </p>
      <OrderList orders={orders} />
    </>
  );
}

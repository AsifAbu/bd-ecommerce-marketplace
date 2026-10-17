import { Suspense } from "react";
import { userOrLogin } from "@/features/accounts/page-guards";
import { Loading, PageShell } from "@/features/accounts/ui/page-shell";
import { ordersOfUser } from "@/features/orders/server";
import { OrderList } from "@/features/orders/ui/order-view";

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
  return <OrderList orders={await ordersOfUser(user.id)} />;
}

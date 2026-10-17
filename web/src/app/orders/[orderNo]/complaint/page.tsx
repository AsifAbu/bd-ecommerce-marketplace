import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { OpenComplaintForm } from "@/features/complaints/ui/complaint-forms";
import { viewableOrder } from "@/features/orders/server";

export const metadata = { title: "Report a problem", robots: { index: false } };

/** US-072: open a complaint about an order (account, or a guest with the order open). Resolved within 72 h. */
export default function ComplaintPage({ params, searchParams }: PageProps<"/orders/[orderNo]/complaint">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-bold">Report a problem</h1>
      <Suspense fallback={<p role="status">Loading…</p>}>
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
  const { shopOrder } = await searchParams;
  const order = await viewableOrder(decodeURIComponent(orderNo));
  if (!order) {
    return (
      <p>
        We can&apos;t show this order here.{" "}
        <Link className="text-blue-800 underline" href={`/track?orderNo=${encodeURIComponent(orderNo)}`}>
          Track it with a code sent to your mobile
        </Link>{" "}
        or log in.
      </p>
    );
  }
  return (
    <>
      <p className="text-sm">
        <Link className="text-blue-800 underline" href={`/orders/${order.orderNo}`}>
          Back to order {order.orderNo}
        </Link>
      </p>
      <p>
        Tell us what went wrong with order {order.orderNo}. The shop and the marketplace team answer in the complaint, and every complaint is
        resolved within 72 hours. You get an SMS when its status changes.
      </p>
      <OpenComplaintForm
        orderNo={order.orderNo}
        shopOrders={order.shopOrders.map((so) => ({ id: so.id, label: `${so.shopOrderNo}: ${so.shopName}` }))}
        defaultShopOrderId={typeof shopOrder === "string" ? shopOrder : undefined}
      />
    </>
  );
}

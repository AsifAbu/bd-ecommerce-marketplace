import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { buttonStyles, Container, EmptyState, linkStyles, PageHeader } from "@/components/ui";
import { ListSkeleton } from "@/features/accounts/ui/auth-shell";
import { OpenComplaintForm } from "@/features/complaints/ui/complaint-forms";
import { viewableOrder } from "@/features/orders/server";

export const metadata = { title: "Report a problem", robots: { index: false } };

/** US-072: open a complaint about an order (account, or a guest with the order open). Resolved within 72 h. */
export default function ComplaintPage({ params, searchParams }: PageProps<"/orders/[orderNo]/complaint">) {
  return (
    <Container as="main" className="flex max-w-2xl flex-1 flex-col gap-6 py-6 sm:py-10">
      <PageHeader title="Report a problem" />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </Container>
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
      <EmptyState
        title="We can't show this order here"
        description="Track it with a code sent to your mobile, or log in."
        action={
          <Link className={buttonStyles()} href={`/track?orderNo=${encodeURIComponent(orderNo)}`}>
            Track this order
          </Link>
        }
      />
    );
  }
  return (
    <>
      <Link className={`${linkStyles} -ml-1 inline-flex min-h-11 items-center gap-1 self-start px-1 text-sm`} href={`/orders/${order.orderNo}`}>
        <ChevronLeft aria-hidden="true" size={16} />
        Back to order {order.orderNo}
      </Link>
      <p className="text-muted">
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

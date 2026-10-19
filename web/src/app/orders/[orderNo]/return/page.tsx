import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { buttonStyles, Container, EmptyState, linkStyles, Notice, PageHeader } from "@/components/ui";
import { ListSkeleton } from "@/features/accounts/ui/auth-shell";
import { viewableOrder } from "@/features/orders/server";
import { formatDhakaDay, REASON_LABELS, RETURN_WINDOW_DAYS } from "@/features/returns";
import { returnsService } from "@/features/returns/server";
import { ReturnRequestForm } from "@/features/returns/ui/return-request-form";
import { isTestMode } from "@/lib/config";

export const metadata = { title: "Request a return", robots: { index: false } };

/**
 * US-070: request a return for one item of a delivered shop order (account, or a guest with the
 * order open after checkout or /track). Shows why when a return is not possible (7-day window,
 * medicine and excluded items, an open request).
 */
export default function ReturnRequestPage({ params, searchParams }: PageProps<"/orders/[orderNo]/return">) {
  return (
    <Container as="main" id="main" className="flex max-w-2xl flex-1 flex-col gap-6 py-6 sm:py-10">
      <PageHeader title="Request a return" />
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
  const sp = await searchParams;
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
  const back = (
    <div className="flex flex-wrap items-center gap-x-5">
      <Link className={`${linkStyles} -ml-1 inline-flex min-h-11 items-center gap-1 px-1 text-sm`} href={`/orders/${order.orderNo}`}>
        <ChevronLeft aria-hidden="true" size={16} />
        Back to order {order.orderNo}
      </Link>
      <Link className={`${linkStyles} inline-flex min-h-11 items-center text-sm`} href="/policies/returns">
        Return and Refund policy
      </Link>
    </div>
  );
  const shopOrder = order.shopOrders.find((s) => s.id === sp.shopOrder) ?? (order.shopOrders.length === 1 ? order.shopOrders[0] : null);
  const itemId = typeof sp.item === "string" ? sp.item : shopOrder?.items.length === 1 ? shopOrder.items[0].id : null;

  if (!itemId) {
    const shopOrders = shopOrder ? [shopOrder] : order.shopOrders;
    return (
      <>
        {back}
        <p className="text-muted">Which item do you want to return? Returns are accepted within {RETURN_WINDOW_DAYS} days of delivery.</p>
        <ul className="divide-y divide-line border-y border-line">
          {shopOrders.flatMap((so) =>
            so.items.map((i) => (
              <li key={i.id}>
                <Link className="-mx-3 flex min-h-14 flex-col justify-center gap-0.5 rounded-md px-3 py-2.5 transition-colors hover:bg-surface" href={`/orders/${order.orderNo}/return?item=${i.id}`}>
                  <span className="font-medium">
                    {i.quantity} × {i.title}
                    {i.variantLabel ? ` (${i.variantLabel})` : ""}
                  </span>
                  <span className="text-sm text-muted">
                    from {so.shopName}: {so.statusLabel}
                  </span>
                </Link>
              </li>
            )),
          )}
        </ul>
      </>
    );
  }

  const options = await returnsService.options(order.id, itemId);
  if (!options) {
    return (
      <>
        {back}
        <Notice tone="error">That item is not part of this order.</Notice>
      </>
    );
  }
  return (
    <>
      {back}
      <h2 className="text-xl font-semibold">
        {options.item.quantity} × {options.item.title}
      </h2>
      {options.lastDay !== null && !options.blocked && (
        <p className="text-muted">Last day to ask for a return: {formatDhakaDay(options.lastDay)}.</p>
      )}
      {options.blocked ? (
        <Notice tone="error" role="alert" data-testid="return-blocked" className="leading-6">
          {options.blocked.message}
        </Notice>
      ) : (
        <>
          {options.limitedBecause && <Notice tone="warning">{options.limitedBecause}</Notice>}
          <ReturnRequestForm
            orderNo={order.orderNo}
            orderItemId={itemId}
            maxQuantity={options.maxQuantity}
            reasons={options.reasons.map((r) => ({ value: r, label: REASON_LABELS[r] }))}
            photosRequired={!isTestMode()}
          />
        </>
      )}
    </>
  );
}

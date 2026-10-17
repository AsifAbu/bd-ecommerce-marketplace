import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-bold">Request a return</h1>
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
  const sp = await searchParams;
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
  const back = (
    <p className="text-sm">
      <Link className="text-blue-800 underline" href={`/orders/${order.orderNo}`}>
        Back to order {order.orderNo}
      </Link>{" "}
      ·{" "}
      <Link className="text-blue-800 underline" href="/policies/returns">
        Return and Refund policy
      </Link>
    </p>
  );
  const shopOrder = order.shopOrders.find((s) => s.id === sp.shopOrder) ?? (order.shopOrders.length === 1 ? order.shopOrders[0] : null);
  const itemId = typeof sp.item === "string" ? sp.item : shopOrder?.items.length === 1 ? shopOrder.items[0].id : null;

  if (!itemId) {
    const shopOrders = shopOrder ? [shopOrder] : order.shopOrders;
    return (
      <>
        {back}
        <p>Which item do you want to return? Returns are accepted within {RETURN_WINDOW_DAYS} days of delivery.</p>
        <ul className="flex flex-col gap-2">
          {shopOrders.flatMap((so) =>
            so.items.map((i) => (
              <li key={i.id}>
                <Link className="text-blue-800 underline" href={`/orders/${order.orderNo}/return?item=${i.id}`}>
                  {i.quantity} × {i.title}
                  {i.variantLabel ? ` (${i.variantLabel})` : ""}
                </Link>{" "}
                <span className="text-sm text-gray-700">
                  from {so.shopName}: {so.statusLabel}
                </span>
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
        <p role="alert">That item is not part of this order.</p>
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
        <p className="text-sm">Last day to ask for a return: {formatDhakaDay(options.lastDay)}.</p>
      )}
      {options.blocked ? (
        <div role="alert" className="rounded border border-red-700 bg-red-50 p-4 text-red-900" data-testid="return-blocked">
          {options.blocked.message}
        </div>
      ) : (
        <>
          {options.limitedBecause && <p className="rounded border border-amber-600 bg-amber-50 p-3 text-sm text-amber-950">{options.limitedBecause}</p>}
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

import type { ReactNode } from "react";
import { formatDhakaTime, formatTk } from "@/features/orders";
import type { ReturnView } from "../views";

const STATUS_STYLE: Record<string, string> = {
  requested: "bg-amber-100 text-amber-900",
  escalated: "bg-red-100 text-red-900",
  refunded: "bg-green-100 text-green-900",
};

/** One return request: item, reason, timeline and refund. Action forms go in `children`. */
export function ReturnCard({ view, audience, children, photoUrls = [] }: { view: ReturnView; audience: "customer" | "shop" | "admin"; children?: ReactNode; photoUrls?: string[] }) {
  const headingId = `return-${view.id}`;
  return (
    <article aria-labelledby={headingId} className="flex flex-col gap-2 rounded border border-gray-300 p-4" data-testid="return-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={headingId} className="font-semibold">
          Return: {view.quantity} × {view.item.title}
          {view.item.variantLabel ? ` (${view.item.variantLabel})` : ""}
        </h3>
        <span className={`rounded px-2 py-0.5 text-sm font-semibold ${STATUS_STYLE[view.status] ?? "bg-gray-100"}`} data-testid="return-status">
          {view.statusLabel}
        </span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="font-medium">Shop order</dt>
        <dd>
          {view.shopOrderNo} ({view.shopName}){audience !== "customer" ? ` · ${view.customerName}` : ""}
        </dd>
        <dt className="font-medium">Reason</dt>
        <dd>{view.reasonLabel}</dd>
        {view.details && (
          <>
            <dt className="font-medium">Details</dt>
            <dd className="whitespace-pre-wrap">{view.details}</dd>
          </>
        )}
        <dt className="font-medium">Photos</dt>
        <dd>
          {view.photoCount === 0
            ? "None"
            : photoUrls.length
              ? photoUrls.map((u, i) => (
                  <a key={u} className="mr-2 text-blue-800 underline" href={u} target="_blank" rel="noreferrer">
                    Photo {i + 1}
                  </a>
                ))
              : `${view.photoCount} photo(s)`}
        </dd>
        <dt className="font-medium">Requested</dt>
        <dd>{formatDhakaTime(view.createdAt)}</dd>
        {view.status === "requested" && (
          <>
            <dt className="font-medium">Shop answers by</dt>
            <dd>
              {formatDhakaTime(view.shopDueAt)}
              {view.shopOverdue && <strong className="ml-2 text-red-800">Overdue: goes to the admin</strong>}
            </dd>
          </>
        )}
        {view.shopNote && (
          <>
            <dt className="font-medium">Shop note</dt>
            <dd>{view.shopNote}</dd>
          </>
        )}
        {view.escalatedAt && (
          <>
            <dt className="font-medium">Escalated</dt>
            <dd>
              {formatDhakaTime(view.escalatedAt)}: {view.escalationReason === "no_response" ? "no answer from the shop in 48 h" : "the customer disputes the rejection"}
              {view.disputeNote ? ` (“${view.disputeNote}”)` : ""}
            </dd>
          </>
        )}
        {view.adminNote && (
          <>
            <dt className="font-medium">Admin decision</dt>
            <dd>{view.adminNote}</dd>
          </>
        )}
        {view.receivedAt && (
          <>
            <dt className="font-medium">Item received</dt>
            <dd>
              {formatDhakaTime(view.receivedAt)}
              {audience !== "customer" ? (view.restocked ? " · back in stock" : " · not restocked") : ""}
            </dd>
          </>
        )}
        {view.refund && (
          <>
            <dt className="font-medium">Refund</dt>
            <dd data-testid="return-refund">
              {formatTk(view.refund.amount)}
              {view.refund.delivery > 0 ? ` (incl. delivery ${formatTk(view.refund.delivery)})` : ""} by {view.refund.methodLabel}, reference{" "}
              {view.refund.reference}, on {formatDhakaTime(view.refund.refundedAt)}
            </dd>
          </>
        )}
      </dl>
      {children}
    </article>
  );
}

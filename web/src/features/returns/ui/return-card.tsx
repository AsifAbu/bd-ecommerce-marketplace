import type { ReactNode } from "react";
import { statusTone } from "@/components/admin/status";
import { Badge } from "@/components/ui";
import { formatDhakaTime, formatTk } from "@/features/orders";
import type { ReturnView } from "../views";

/** One return request: item, reason, timeline and refund. Action forms go in `children`. */
export function ReturnCard({ view, audience, children, photoUrls = [] }: { view: ReturnView; audience: "customer" | "shop" | "admin"; children?: ReactNode; photoUrls?: string[] }) {
  const headingId = `return-${view.id}`;
  return (
    <article aria-labelledby={headingId} className="flash-result flex flex-col gap-4 rounded-lg border border-line p-4 sm:p-5" data-testid="return-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id={headingId} className="text-lg font-semibold">
          Return: {view.quantity} × {view.item.title}
          {view.item.variantLabel ? ` (${view.item.variantLabel})` : ""}
        </h3>
        <Badge tone={statusTone(view.status)} className="text-sm" data-testid="return-status">
          {view.statusLabel}
        </Badge>
      </div>
      <dl className="grid grid-cols-[7.5rem_1fr] gap-x-4 gap-y-1.5 text-sm [&_dd]:min-w-0 [&_dd]:break-words [&_dt]:text-muted">
        <dt>Shop order</dt>
        <dd>
          {view.shopOrderNo} ({view.shopName}){audience !== "customer" ? `, ${view.customerName}` : ""}
        </dd>
        <dt>Reason</dt>
        <dd>{view.reasonLabel}</dd>
        {view.details && (
          <>
            <dt>Details</dt>
            <dd className="whitespace-pre-wrap">{view.details}</dd>
          </>
        )}
        <dt>Photos</dt>
        <dd>
          {view.photoCount === 0
            ? "None"
            : photoUrls.length
              ? photoUrls.map((u, i) => (
                  <a key={u} className="mr-3 font-medium text-jade underline-offset-4 hover:underline" href={u} target="_blank" rel="noreferrer">
                    Photo {i + 1}
                  </a>
                ))
              : `${view.photoCount} photo(s)`}
        </dd>
        <dt>Requested</dt>
        <dd>{formatDhakaTime(view.createdAt)}</dd>
        {view.status === "requested" && (
          <>
            <dt>Shop answers by</dt>
            <dd>
              {formatDhakaTime(view.shopDueAt)}
              {view.shopOverdue && (
                <Badge tone="sale" className="ml-2">
                  Overdue: goes to the admin
                </Badge>
              )}
            </dd>
          </>
        )}
        {view.shopNote && (
          <>
            <dt>Shop note</dt>
            <dd>{view.shopNote}</dd>
          </>
        )}
        {view.escalatedAt && (
          <>
            <dt>Escalated</dt>
            <dd>
              {formatDhakaTime(view.escalatedAt)}: {view.escalationReason === "no_response" ? "no answer from the shop in 48 h" : "the customer disputes the rejection"}
              {view.disputeNote ? ` (“${view.disputeNote}”)` : ""}
            </dd>
          </>
        )}
        {view.adminNote && (
          <>
            <dt>Admin decision</dt>
            <dd>{view.adminNote}</dd>
          </>
        )}
        {view.receivedAt && (
          <>
            <dt>Item received</dt>
            <dd>
              {formatDhakaTime(view.receivedAt)}
              {audience !== "customer" ? (view.restocked ? ", back in stock" : ", not restocked") : ""}
            </dd>
          </>
        )}
        {view.refund && (
          <>
            <dt>Refund</dt>
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

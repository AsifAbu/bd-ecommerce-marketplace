import type { ReactNode } from "react";
import { Badge, linkStyles, statusTone } from "@/components/ui";
import { formatDhakaTime, formatTk } from "@/features/orders";
import type { ReturnView } from "../views";

const dt = "text-sm text-muted sm:pt-0.5";
const dd = "min-w-0 break-words";

/** One return request: item, reason, timeline and refund. Action forms go in `children`. */
export function ReturnCard({ view, audience, children, photoUrls = [] }: { view: ReturnView; audience: "customer" | "shop" | "admin"; children?: ReactNode; photoUrls?: string[] }) {
  const headingId = `return-${view.id}`;
  return (
    <article aria-labelledby={headingId} className="flex flex-col gap-4 rounded-lg border border-line p-4 sm:p-5" data-testid="return-card">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h3 id={headingId} className="min-w-0 text-base font-semibold">
          Return: {view.quantity} × {view.item.title}
          {view.item.variantLabel ? ` (${view.item.variantLabel})` : ""}
        </h3>
        <Badge tone={statusTone(view.status)} data-testid="return-status">
          {view.statusLabel}
        </Badge>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-y-2">
        <dt className={dt}>Shop order</dt>
        <dd className={dd}>
          {view.shopOrderNo} ({view.shopName}){audience !== "customer" ? `, ${view.customerName}` : ""}
        </dd>
        <dt className={dt}>Reason</dt>
        <dd className={dd}>{view.reasonLabel}</dd>
        {view.details && (
          <>
            <dt className={dt}>Details</dt>
            <dd className={`${dd} whitespace-pre-wrap`}>{view.details}</dd>
          </>
        )}
        <dt className={dt}>Photos</dt>
        <dd className={dd}>
          {view.photoCount === 0
            ? "None"
            : photoUrls.length
              ? photoUrls.map((u, i) => (
                  <a key={u} className={`${linkStyles} mr-3 inline-flex min-h-11 items-center`} href={u} target="_blank" rel="noreferrer">
                    Photo {i + 1}
                  </a>
                ))
              : `${view.photoCount} photo(s)`}
        </dd>
        <dt className={dt}>Requested</dt>
        <dd className={dd}>{formatDhakaTime(view.createdAt)}</dd>
        {view.status === "requested" && (
          <>
            <dt className={dt}>Shop answers by</dt>
            <dd className={dd}>
              {formatDhakaTime(view.shopDueAt)}
              {view.shopOverdue && (
                <Badge tone="sale" className="ml-2">
                  Overdue, goes to the admin
                </Badge>
              )}
            </dd>
          </>
        )}
        {view.shopNote && (
          <>
            <dt className={dt}>Shop note</dt>
            <dd className={dd}>{view.shopNote}</dd>
          </>
        )}
        {view.escalatedAt && (
          <>
            <dt className={dt}>Escalated</dt>
            <dd className={dd}>
              {formatDhakaTime(view.escalatedAt)}: {view.escalationReason === "no_response" ? "no answer from the shop in 48 h" : "the customer disputes the rejection"}
              {view.disputeNote ? ` (“${view.disputeNote}”)` : ""}
            </dd>
          </>
        )}
        {view.adminNote && (
          <>
            <dt className={dt}>Admin decision</dt>
            <dd className={dd}>{view.adminNote}</dd>
          </>
        )}
        {view.receivedAt && (
          <>
            <dt className={dt}>Item received</dt>
            <dd className={dd}>
              {formatDhakaTime(view.receivedAt)}
              {audience !== "customer" ? (view.restocked ? ", back in stock" : ", not restocked") : ""}
            </dd>
          </>
        )}
        {view.refund && (
          <>
            <dt className={dt}>Refund</dt>
            <dd className={dd} data-testid="return-refund">
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

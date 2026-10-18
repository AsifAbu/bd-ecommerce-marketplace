import Link from "next/link";
import { statusTone } from "@/components/admin/status";
import { Badge, EmptyState } from "@/components/ui";
import { formatDhakaTime } from "@/features/orders";
import type { TicketView } from "../views";

/** Due time with an overdue badge (72 h timer). */
export function DueBadge({ ticket }: { ticket: TicketView }) {
  if (!ticket.active) {
    return (
      <span className="text-sm text-muted">
        {ticket.statusLabel} {ticket.resolvedAt ? formatDhakaTime(ticket.resolvedAt) : ""}
        {ticket.resolvedOnTime === false ? " (after 72 h)" : ""}
      </span>
    );
  }
  if (ticket.overdue) {
    return (
      <Badge tone="sale" className="text-sm" data-testid="overdue-badge">
        Overdue since {formatDhakaTime(ticket.dueAt)}
      </Badge>
    );
  }
  return (
    <Badge tone="warning" className="text-sm">
      Due {formatDhakaTime(ticket.dueAt)} ({ticket.hoursLeft} h left)
    </Badge>
  );
}

/** A list of tickets; `href` builds each ticket's link for the audience. Overdue ones are tinted and say so in words. */
export function TicketList({ tickets, href, showCustomer = false, empty = "No complaints." }: { tickets: TicketView[]; href: (t: TicketView) => string; showCustomer?: boolean; empty?: string }) {
  if (!tickets.length) return <EmptyState title={empty} />;
  return (
    <ul className="overflow-hidden rounded-lg border border-line" aria-label="Complaints">
      {tickets.map((t) => (
        <li
          key={t.id}
          className={`flex flex-col gap-2 border-t border-line p-4 first:border-t-0 ${t.overdue ? "bg-vermilion-soft/50" : ""}`}
          data-testid="complaint-row"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link className="min-w-0 font-semibold text-jade underline-offset-4 hover:underline" href={href(t)}>
              {t.ticketNo}: {t.subject}
            </Link>
            <Badge tone={statusTone(t.status)} className="text-sm">
              {t.statusLabel}
            </Badge>
          </div>
          <p className="text-sm text-muted">
            {t.categoryLabel}
            {t.shopOrderNo ? `, ${t.shopOrderNo} (${t.shopName})` : t.orderNo ? `, order ${t.orderNo}` : ""}
            {showCustomer && t.customerName ? `, ${t.customerName}` : ""}. Opened {formatDhakaTime(t.createdAt)}, {t.messageCount} message(s).
          </p>
          <div>
            <DueBadge ticket={t} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Ticket header and its thread. */
export function TicketThread({ ticket }: { ticket: TicketView }) {
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-[7.5rem_1fr] gap-x-4 gap-y-1.5 text-sm [&_dd]:min-w-0 [&_dd]:break-words [&_dt]:text-muted">
        <dt>Complaint</dt>
        <dd>{ticket.ticketNo}</dd>
        <dt>About</dt>
        <dd>
          {ticket.categoryLabel}
          {ticket.shopOrderNo ? `: ${ticket.shopOrderNo} (${ticket.shopName})` : ticket.orderNo ? `: order ${ticket.orderNo}` : ""}
        </dd>
        <dt>Status</dt>
        <dd data-testid="complaint-status">{ticket.statusLabel}</dd>
        <dt>Opened</dt>
        <dd>{formatDhakaTime(ticket.createdAt)}</dd>
        <dt>Resolve by</dt>
        <dd>
          <DueBadge ticket={ticket} />
        </dd>
        {ticket.resolution && (
          <>
            <dt>Resolution</dt>
            <dd className="whitespace-pre-wrap" data-testid="complaint-resolution">
              {ticket.resolution}
            </dd>
          </>
        )}
      </dl>
      <ol className="flex flex-col gap-3" aria-label="Messages">
        {ticket.messages.map((m) => (
          <li key={m.id} className={`flex flex-col gap-1 rounded-lg p-4 ${m.authorRole === "customer" ? "bg-surface" : "bg-jade-soft"}`}>
            <p className="text-sm font-semibold">
              {m.authorLabel} <span className="font-normal text-muted">{formatDhakaTime(m.createdAt)}</span>
            </p>
            <p className="whitespace-pre-wrap">{m.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

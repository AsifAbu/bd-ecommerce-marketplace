import Link from "next/link";
import { Badge, cn, statusTone } from "@/components/ui";
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
      <Badge tone="sale" data-testid="overdue-badge">
        Overdue since {formatDhakaTime(ticket.dueAt)}
      </Badge>
    );
  }
  return (
    <Badge tone="warning">
      Due {formatDhakaTime(ticket.dueAt)} ({ticket.hoursLeft} h left)
    </Badge>
  );
}

/** A list of tickets; `href` builds each ticket's link for the audience. */
export function TicketList({ tickets, href, showCustomer = false, empty = "No complaints." }: { tickets: TicketView[]; href: (t: TicketView) => string; showCustomer?: boolean; empty?: string }) {
  if (!tickets.length) return <p className="rounded-lg bg-surface p-6 text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line border-y border-line" aria-label="Complaints">
      {tickets.map((t) => (
        <li key={t.id} className="flex flex-col gap-2 py-4" data-testid="complaint-row">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <Link className="min-w-0 break-words font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink" href={href(t)}>
              {t.ticketNo}: {t.subject}
            </Link>
            <Badge tone={statusTone(t.status)}>{t.statusLabel}</Badge>
          </div>
          <p className="text-sm text-muted">
            {t.categoryLabel}
            {t.shopOrderNo ? `, ${t.shopOrderNo} (${t.shopName})` : t.orderNo ? `, order ${t.orderNo}` : ""}
            {showCustomer && t.customerName ? `, ${t.customerName}` : ""}
          </p>
          <p className="text-sm text-muted">
            Opened {formatDhakaTime(t.createdAt)}, {t.messageCount} {t.messageCount === 1 ? "message" : "messages"}
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
  const dt = "text-sm text-muted sm:pt-0.5";
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-y-2">
        <dt className={dt}>Complaint</dt>
        <dd>{ticket.ticketNo}</dd>
        <dt className={dt}>About</dt>
        <dd>
          {ticket.categoryLabel}
          {ticket.shopOrderNo ? `: ${ticket.shopOrderNo} (${ticket.shopName})` : ticket.orderNo ? `: order ${ticket.orderNo}` : ""}
        </dd>
        <dt className={dt}>Status</dt>
        <dd data-testid="complaint-status">{ticket.statusLabel}</dd>
        <dt className={dt}>Opened</dt>
        <dd>{formatDhakaTime(ticket.createdAt)}</dd>
        <dt className={dt}>Resolve by</dt>
        <dd>
          <DueBadge ticket={ticket} />
        </dd>
        {ticket.resolution && (
          <>
            <dt className={dt}>Resolution</dt>
            <dd className="whitespace-pre-wrap" data-testid="complaint-resolution">
              {ticket.resolution}
            </dd>
          </>
        )}
      </dl>
      <ol className="flex flex-col gap-3" aria-label="Messages">
        {ticket.messages.map((m) => (
          <li key={m.id} className={cn("flex flex-col gap-1 rounded-lg p-4", m.authorRole === "customer" ? "border border-line" : "bg-surface")}>
            <p className="text-sm font-semibold">
              {m.authorLabel} <span className="font-normal text-muted">{formatDhakaTime(m.createdAt)}</span>
            </p>
            <p className="whitespace-pre-wrap break-words">{m.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

import Link from "next/link";
import { formatDhakaTime } from "@/features/orders";
import type { TicketView } from "../views";

/** Due time with an overdue badge (72 h timer). */
export function DueBadge({ ticket }: { ticket: TicketView }) {
  if (!ticket.active) {
    return (
      <span className="text-sm">
        {ticket.statusLabel} {ticket.resolvedAt ? formatDhakaTime(ticket.resolvedAt) : ""}
        {ticket.resolvedOnTime === false ? " (after 72 h)" : ""}
      </span>
    );
  }
  if (ticket.overdue) {
    return (
      <span className="rounded bg-red-700 px-2 py-0.5 text-sm font-semibold text-white" data-testid="overdue-badge">
        Overdue since {formatDhakaTime(ticket.dueAt)}
      </span>
    );
  }
  return (
    <span className="rounded bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-950">
      Due {formatDhakaTime(ticket.dueAt)} ({ticket.hoursLeft} h left)
    </span>
  );
}

/** A list of tickets; `href` builds each ticket's link for the audience. */
export function TicketList({ tickets, href, showCustomer = false, empty = "No complaints." }: { tickets: TicketView[]; href: (t: TicketView) => string; showCustomer?: boolean; empty?: string }) {
  if (!tickets.length) return <p>{empty}</p>;
  return (
    <ul className="flex flex-col gap-3" aria-label="Complaints">
      {tickets.map((t) => (
        <li key={t.id} className={`flex flex-col gap-1 rounded border p-3 ${t.overdue ? "border-red-700" : "border-gray-300"}`} data-testid="complaint-row">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Link className="font-semibold text-blue-800 underline" href={href(t)}>
              {t.ticketNo}: {t.subject}
            </Link>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-sm font-semibold">{t.statusLabel}</span>
          </div>
          <p className="text-sm">
            {t.categoryLabel}
            {t.shopOrderNo ? ` · ${t.shopOrderNo} (${t.shopName})` : t.orderNo ? ` · order ${t.orderNo}` : ""}
            {showCustomer && t.customerName ? ` · ${t.customerName}` : ""} · opened {formatDhakaTime(t.createdAt)} · {t.messageCount} message(s)
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
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="font-medium">Complaint</dt>
        <dd>{ticket.ticketNo}</dd>
        <dt className="font-medium">About</dt>
        <dd>
          {ticket.categoryLabel}
          {ticket.shopOrderNo ? `: ${ticket.shopOrderNo} (${ticket.shopName})` : ticket.orderNo ? `: order ${ticket.orderNo}` : ""}
        </dd>
        <dt className="font-medium">Status</dt>
        <dd data-testid="complaint-status">{ticket.statusLabel}</dd>
        <dt className="font-medium">Opened</dt>
        <dd>{formatDhakaTime(ticket.createdAt)}</dd>
        <dt className="font-medium">Resolve by</dt>
        <dd>
          <DueBadge ticket={ticket} />
        </dd>
        {ticket.resolution && (
          <>
            <dt className="font-medium">Resolution</dt>
            <dd className="whitespace-pre-wrap" data-testid="complaint-resolution">
              {ticket.resolution}
            </dd>
          </>
        )}
      </dl>
      <ol className="flex flex-col gap-3" aria-label="Messages">
        {ticket.messages.map((m) => (
          <li key={m.id} className={`rounded border p-3 ${m.authorRole === "customer" ? "border-gray-300" : "border-blue-300 bg-blue-50"}`}>
            <p className="text-sm font-semibold">
              {m.authorLabel} · {formatDhakaTime(m.createdAt)}
            </p>
            <p className="whitespace-pre-wrap">{m.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

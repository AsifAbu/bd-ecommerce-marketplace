import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { customerComplaint } from "@/features/complaints/server";
import { CustomerReplyForm } from "@/features/complaints/ui/complaint-forms";
import { TicketThread } from "@/features/complaints/ui/ticket-views";

export const metadata = { title: "Your complaint", robots: { index: false } };

/** US-072: the customer's complaint and its thread (account, or a guest with the order open). */
export default function CustomerComplaintPage({ params, searchParams }: PageProps<"/complaints/[ticketId]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
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
  params: Promise<{ ticketId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { ticketId } = await params;
  const { opened } = await searchParams;
  const found = await customerComplaint(ticketId);
  if (!found) {
    return (
      <>
        <h1 className="text-3xl font-bold">Complaint not found</h1>
        <p>
          Log in, or{" "}
          <Link className="text-blue-800 underline" href="/track">
            open your order with a code sent to your mobile
          </Link>{" "}
          to see this complaint.
        </p>
      </>
    );
  }
  const { ticket } = found;
  return (
    <>
      <h1 className="text-3xl font-bold">{ticket.subject}</h1>
      {opened === "1" && (
        <div role="status" className="rounded border border-green-700 bg-green-50 p-3 text-green-900">
          Complaint {ticket.ticketNo} received. We will resolve it within 72 hours and inform you at each step.
        </div>
      )}
      {ticket.orderNo && (
        <p className="text-sm">
          <Link className="text-blue-800 underline" href={`/orders/${ticket.orderNo}`}>
            Order {ticket.orderNo}
          </Link>
        </p>
      )}
      <TicketThread ticket={ticket} />
      {ticket.active && <CustomerReplyForm ticketId={ticket.id} />}
    </>
  );
}

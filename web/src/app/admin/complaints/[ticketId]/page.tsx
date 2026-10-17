import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { complaintDetail } from "@/features/complaints/server";
import { AdminComplaintForms } from "@/features/complaints/ui/complaint-forms";
import { TicketThread } from "@/features/complaints/ui/ticket-views";
import { guardPage } from "@/features/shops/page-guard";
import { requirePlatformAdmin } from "@/lib/auth";

export const metadata = { title: "Complaint: admin" };

/** US-072: one complaint for the admin: thread, reply, start, resolve or close. */
export default function AdminComplaintPage({ params }: PageProps<"/admin/complaints/[ticketId]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-10">
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: Promise<{ ticketId: string }> }) {
  await connection();
  const { ticketId } = await params;
  await guardPage(`/admin/complaints/${ticketId}`, requirePlatformAdmin);
  const ticket = await complaintDetail({ kind: "admin" }, ticketId);
  if (!ticket) notFound();
  return (
    <>
      <p className="text-sm">
        <Link className="text-blue-800 underline" href="/admin/complaints">
          Complaints queue
        </Link>
      </p>
      <h1 className="text-2xl font-bold">{ticket.subject}</h1>
      {ticket.customerName && <p className="text-sm">Customer: {ticket.customerName}</p>}
      <TicketThread ticket={ticket} />
      {ticket.active && <AdminComplaintForms ticketId={ticket.id} status={ticket.status} />}
    </>
  );
}

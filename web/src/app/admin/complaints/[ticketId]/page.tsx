import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/loading";
import { AdminPageHeader } from "@/components/admin/page-header";
import { complaintDetail } from "@/features/complaints/server";
import { AdminComplaintForms } from "@/features/complaints/ui/complaint-forms";
import { TicketThread } from "@/features/complaints/ui/ticket-views";
import { guardPage } from "@/features/shops/page-guard";
import { requirePlatformAdmin } from "@/lib/auth";

export const metadata = { title: "Complaint: admin" };

/** US-072: one complaint for the admin: thread, reply, start, resolve or close. */
export default function AdminComplaintPage({ params }: PageProps<"/admin/complaints/[ticketId]">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Content params={params} />
    </Suspense>
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
      <AdminPageHeader
        title={ticket.subject}
        description={ticket.customerName ? `Customer: ${ticket.customerName}` : undefined}
        crumbs={[{ label: "Complaints", href: "/admin/complaints" }, { label: ticket.ticketNo }]}
      />
      <TicketThread ticket={ticket} />
      {ticket.active && <AdminComplaintForms ticketId={ticket.id} status={ticket.status} />}
    </>
  );
}

import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { COMPLAINT_STATUS_LABELS, COMPLAINT_STATUSES, type ComplaintStatus } from "@/features/complaints";
import { complaintQueue } from "@/features/complaints/server";
import { TicketList } from "@/features/complaints/ui/ticket-views";
import { guardPage } from "@/features/shops/page-guard";
import { requirePlatformAdmin } from "@/lib/auth";

export const metadata = { title: "Complaints: admin" };

/** US-072: the complaints queue by due time (72 h), overdue first, with the compliance-officer note. */
export default function AdminComplaintsPage({ searchParams }: PageProps<"/admin/complaints">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-bold">Complaints: admin</h1>
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  await guardPage("/admin/complaints", requirePlatformAdmin);
  const { status: s } = await searchParams;
  const status = typeof s === "string" && (COMPLAINT_STATUSES as readonly string[]).includes(s) ? (s as ComplaintStatus) : null;
  const tickets = await complaintQueue(status ? [status] : undefined);
  const overdue = tickets.filter((t) => t.overdue).length;
  const officer = process.env.COMPLIANCE_OFFICER?.trim();
  return (
    <>
      <aside aria-label="Compliance officer" className="rounded border border-blue-700 bg-blue-50 p-3 text-sm text-blue-950">
        <p className="font-semibold">Compliance officer</p>
        <p>
          {officer ? `${officer} is responsible for complaints.` : "Not named yet: the company must appoint a compliance officer before release (pre-release checklist)."}{" "}
          Digital Commerce Operation Guidelines 2021: every complaint is recorded and resolved within 72 hours, and the customer is informed. Target: 95% or
          more resolved on time. Records are kept for 6 years.
        </p>
      </aside>
      <nav aria-label="Complaint status" className="flex flex-wrap gap-3 text-sm">
        <Link className={`underline ${!status ? "font-bold" : ""}`} aria-current={!status ? "page" : undefined} href="/admin/complaints">
          Active (open and in progress)
        </Link>
        {COMPLAINT_STATUSES.map((st) => (
          <Link key={st} className={`underline ${st === status ? "font-bold" : ""}`} aria-current={st === status ? "page" : undefined} href={`/admin/complaints?status=${st}`}>
            {COMPLAINT_STATUS_LABELS[st]}
          </Link>
        ))}
        <Link className="underline" href="/admin/returns">
          Escalated returns
        </Link>
      </nav>
      <p role="status">
        {tickets.length} complaint(s){overdue ? `, ${overdue} overdue` : ""}. Sorted by due time, overdue first.
      </p>
      <TicketList tickets={tickets} href={(t) => `/admin/complaints/${t.id}`} showCustomer empty="No complaints here." />
    </>
  );
}

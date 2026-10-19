import { connection } from "next/server";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/loading";
import { AdminPageHeader } from "@/components/admin/page-header";
import { FilterChips, Notice } from "@/components/ui";
import { COMPLAINT_STATUS_LABELS, COMPLAINT_STATUSES, type ComplaintStatus } from "@/features/complaints";
import { complaintQueue } from "@/features/complaints/server";
import { TicketList } from "@/features/complaints/ui/ticket-views";
import { guardPage } from "@/features/shops/page-guard";
import { requirePlatformAdmin } from "@/lib/auth";

export const metadata = { title: "Complaints: admin" };

/** US-072: the complaints queue by due time (72 h), overdue first, with the compliance-officer note. */
export default function AdminComplaintsPage({ searchParams }: PageProps<"/admin/complaints">) {
  return (
    <>
      <AdminPageHeader title="Complaints" description="Every complaint is recorded and must be resolved within 72 hours. The most overdue come first." />
      <Suspense fallback={<AdminLoading />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
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
      <aside aria-label="Compliance officer">
        <Notice tone={officer ? "info" : "warning"}>
          <p className="font-semibold">Compliance officer</p>
          <p>
            {officer ? `${officer} is responsible for complaints.` : "Not named yet: the company must appoint a compliance officer before release (pre-release checklist)."}{" "}
            Digital Commerce Operation Guidelines 2021: every complaint is recorded and resolved within 72 hours, and the customer is informed. Target: 95% or
            more resolved on time. Records are kept for 6 years.
          </p>
        </Notice>
      </aside>
      <FilterChips
        label="Complaint status"
        items={[
          { label: "Active (open and in progress)", href: "/admin/complaints", current: !status },
          ...COMPLAINT_STATUSES.map((st) => ({ label: COMPLAINT_STATUS_LABELS[st], href: `/admin/complaints?status=${st}`, current: st === status })),
        ]}
      />
      <p role="status" className={overdue ? "font-medium text-vermilion" : "text-muted"}>
        {tickets.length} complaint(s){overdue ? `, ${overdue} overdue` : ""}. Sorted by due time, overdue first.
      </p>
      <TicketList tickets={tickets} href={(t) => `/admin/complaints/${t.id}`} showCustomer empty="No complaints here." />
    </>
  );
}

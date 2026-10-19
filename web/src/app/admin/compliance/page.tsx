import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/loading";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminGate } from "@/features/policies/ui/admin-gate";
import { ComplianceRecords } from "@/features/policies/ui/compliance-records";

export const metadata = { title: "DBID and record retention" };

export default function CompliancePage() {
  return (
    <>
      <AdminPageHeader title="DBID and record retention" description="The Digital Business ID shown on every page, and how long the marketplace keeps each kind of record." />
      <Suspense fallback={<AdminLoading />}>
        <AdminGate callbackUrl="/admin/compliance">
          <ComplianceRecords />
        </AdminGate>
      </Suspense>
    </>
  );
}

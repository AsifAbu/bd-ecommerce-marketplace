import Link from "next/link";
import { Suspense } from "react";
import { AdminGate } from "@/features/policies/ui/admin-gate";
import { ComplianceRecords } from "@/features/policies/ui/compliance-records";

export const metadata = { title: "DBID and record retention" };

export default function CompliancePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-3xl font-bold">DBID and record retention</h1>
      <p className="text-sm">
        <Link className="underline" href="/admin/policies">
          Policies admin
        </Link>
      </p>
      <Suspense fallback={<p role="status">Loading…</p>}>
        <AdminGate callbackUrl="/admin/compliance">
          <ComplianceRecords />
        </AdminGate>
      </Suspense>
    </main>
  );
}

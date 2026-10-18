import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/loading";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminGate } from "@/features/policies/ui/admin-gate";
import { AdminPolicyList } from "@/features/policies/ui/admin-policies";

export const metadata = { title: "Policies admin" };

export default function AdminPoliciesPage() {
  return (
    <>
      <AdminPageHeader
        title="Policies"
        description="The legal texts shown to buyers and sellers. Each change is a new version; customers accept the current one at sign-up or checkout."
      />
      <Suspense fallback={<AdminLoading />}>
        <AdminGate callbackUrl="/admin/policies">
          <AdminPolicyList />
        </AdminGate>
      </Suspense>
    </>
  );
}
